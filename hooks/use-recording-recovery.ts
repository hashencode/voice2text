import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { hasRecordingSession, upsertRecordingMeta } from '~/data/sqlite/services/recordings.service';
import {
    listRecordSessionDrafts,
    saveRecordSessionDraft,
    type RecordSessionDraft,
} from '~/features/session-editor/services/record-session-draft';
import { discardRecordSessionDraft } from '~/features/session-editor/services/record-session-workflow';
import SherpaOnnx, { type RecoverableWavRecording } from '~/modules/sherpa';

type WavFileMeta = {
    path: string;
    sampleRate: number | null;
    numSamples: number | null;
    durationMs: number | null;
    recordedAtMs: number | null;
};

type RecoveryResult = {
    recoveredCount: number;
    importedCount: number;
    failedCount: number;
    revivedDrafts: RecordSessionDraft[];
};

const MAX_RECOVERY_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function readWavMeta(path: string): Promise<WavFileMeta> {
    const fileInfo = await FileSystem.getInfoAsync(path);
    const info = await SherpaOnnx.getWavInfo(path);
    const rawModifiedAt =
        'modificationTime' in fileInfo && typeof fileInfo.modificationTime === 'number' ? fileInfo.modificationTime : null;
    const endedAtMs = rawModifiedAt === null ? null : rawModifiedAt > 1e12 ? rawModifiedAt : rawModifiedAt * 1000;
    const recordedAtMs =
        endedAtMs === null ? null : info.durationMs !== null && info.durationMs > 0 ? Math.max(0, endedAtMs - info.durationMs) : endedAtMs;
    return {
        path,
        sampleRate: info.sampleRate,
        numSamples: info.numSamples,
        durationMs: info.durationMs,
        recordedAtMs,
    };
}

function askRecoveryConfirm(sessionCount: number): Promise<'recover' | 'discard'> {
    return new Promise(resolve => {
        Alert.alert('检测到未完成录音', `上次有 ${sessionCount} 条录音还没处理完，是否继续恢复？`, [
            {
                text: '放弃并删除',
                style: 'destructive',
                onPress: () => resolve('discard'),
            },
            {
                text: '继续处理',
                onPress: () => resolve('recover'),
            },
        ]);
    });
}

async function recoverSessions(
    sessions: RecoverableWavRecording[],
    draftsBySessionId: Map<string, RecordSessionDraft>,
): Promise<RecoveryResult> {
    let recoveredCount = 0;
    let importedCount = 0;
    let failedCount = 0;
    const revivedDrafts: RecordSessionDraft[] = [];

    for (const session of sessions) {
        let recovered: Awaited<ReturnType<typeof SherpaOnnx.recoverWavRecordingSession>> = null;

        for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt += 1) {
            try {
                recovered = await SherpaOnnx.recoverWavRecordingSession(session.sessionId);
                if (recovered?.path) {
                    break;
                }
            } catch (error) {
                console.warn('[recording-recovery] recover attempt failed', {
                    sessionId: session.sessionId,
                    attemptNo: attempt,
                    message: (error as Error).message,
                });
            }

            if (attempt < MAX_RECOVERY_ATTEMPTS) {
                await sleep(250);
            }
        }

        if (!recovered?.path) {
            failedCount += 1;
            continue;
        }
        recoveredCount += 1;

        const draft = draftsBySessionId.get(session.sessionId);
        if (draft) {
            const info = await SherpaOnnx.getWavInfo(recovered.path);
            const nextDraft: RecordSessionDraft = {
                ...draft,
                outputPath: recovered.path,
                durationMs: draft.durationMs || info.durationMs || 0,
                state: 'confirming',
                updatedAtMs: Date.now(),
            };
            await saveRecordSessionDraft(nextDraft);
            revivedDrafts.push(nextDraft);
            draftsBySessionId.delete(session.sessionId);
            continue;
        }

        const normalizedSessionId = recovered.sessionId?.trim();
        const alreadyImported = normalizedSessionId ? await hasRecordingSession(normalizedSessionId) : false;
        if (alreadyImported) {
            continue;
        }

        const meta = await readWavMeta(recovered.path);
        await upsertRecordingMeta({
            ...meta,
            sessionId: normalizedSessionId,
            reason: recovered.reason,
        });
        importedCount += 1;
    }

    revivedDrafts.push(...draftsBySessionId.values());

    return { recoveredCount, importedCount, failedCount, revivedDrafts };
}

async function discardAllRecoverables(
    recoverableSessions: RecoverableWavRecording[],
    draftMap: Map<string, RecordSessionDraft>,
): Promise<void> {
    const sessionIds = recoverableSessions.map(item => item.sessionId).filter(Boolean);
    if (sessionIds.length > 0) {
        await SherpaOnnx.discardRecoverableWavRecordings(sessionIds);
    }
    await Promise.all(Array.from(draftMap.values()).map(draft => discardRecordSessionDraft(draft)));
}

export function useRecordingRecovery(): void {
    const hasCheckedRef = useRef(false);

    useEffect(() => {
        if (hasCheckedRef.current) {
            return;
        }
        hasCheckedRef.current = true;

        (async () => {
            try {
                const [recoverableSessions, drafts] = await Promise.all([
                    SherpaOnnx.listRecoverableWavRecordings(),
                    listRecordSessionDrafts(),
                ]);
                const draftMap = new Map(drafts.map(draft => [draft.sessionId, draft]));
                const sessionCount = new Set([...recoverableSessions.map(item => item.sessionId), ...draftMap.keys()]).size;
                if (sessionCount <= 0) {
                    return;
                }

                const action = await askRecoveryConfirm(sessionCount);
                if (action === 'discard') {
                    await discardAllRecoverables(recoverableSessions, draftMap);
                    return;
                }

                const { recoveredCount, importedCount, failedCount, revivedDrafts } = await recoverSessions(recoverableSessions, draftMap);
                if (revivedDrafts.length === 1) {
                    router.replace({
                        pathname: '/record-review',
                        params: { sessionId: revivedDrafts[0].sessionId },
                    });
                }
                Alert.alert('恢复完成', `已恢复 ${recoveredCount} 条异常录音，成功入库 ${importedCount} 条，失败 ${failedCount} 条。`);
            } catch (error) {
                Alert.alert('恢复失败', (error as Error).message ?? '未知错误');
            }
        })();
    }, []);
}
