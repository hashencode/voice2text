import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { hasRecordingSession, upsertRecordingMeta } from '~/data/sqlite/services/recordings.service';
import SherpaOnnx, { type RecoverableWavRecording } from '~/modules/sherpa';

type WavFileMeta = {
    path: string;
    sampleRate: number | null;
    numSamples: number | null;
    durationMs: number | null;
    recordedAtMs: number | null;
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
    // 统一 recordedAtMs 语义为“录音开始时间”；恢复场景下文件修改时间更接近结束时间，所以减去时长回推。
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
        Alert.alert('检测到录音异常退出', `上次有 ${sessionCount} 条录音异常退出，是否尝试恢复？`, [
            {
                text: '取消并删除切片',
                style: 'destructive',
                onPress: () => resolve('discard'),
            },
            {
                text: '恢复',
                onPress: () => resolve('recover'),
            },
        ]);
    });
}

async function recoverSessions(
    sessions: RecoverableWavRecording[],
): Promise<{ recoveredCount: number; importedCount: number; failedCount: number }> {
    let recoveredCount = 0;
    let importedCount = 0;
    let failedCount = 0;

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

    return { recoveredCount, importedCount, failedCount };
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
                const recoverableSessions = await SherpaOnnx.listRecoverableWavRecordings();
                if (recoverableSessions.length <= 0) {
                    return;
                }

                const action = await askRecoveryConfirm(recoverableSessions.length);
                if (action === 'discard') {
                    const sessionIds = recoverableSessions.map(item => item.sessionId).filter(Boolean);
                    await SherpaOnnx.discardRecoverableWavRecordings(sessionIds);
                    return;
                }

                const { recoveredCount, importedCount, failedCount } = await recoverSessions(recoverableSessions);
                Alert.alert('恢复完成', `已恢复 ${recoveredCount} 条异常录音，成功入库 ${importedCount} 条，失败 ${failedCount} 条。`);
            } catch (error) {
                Alert.alert('恢复失败', (error as Error).message ?? '未知错误');
            }
        })();
    }, []);
}
