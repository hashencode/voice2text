import * as FileSystem from 'expo-file-system/legacy';
import type { RecordingMarker } from '~/data/sqlite/types';

const RECORDING_SESSION_ROOT = 'sherpa/wav-recordings/sessions';
const RECORDING_DRAFT_FILE = 'draft.session.json';

export type RecordSessionDraftState = 'recording' | 'confirming';

export type RecordSessionDraft = {
    sessionId: string;
    outputPath: string;
    displayName: string;
    noteText: string;
    groupName: string | null;
    recordedAtMs: number;
    durationMs: number;
    state: RecordSessionDraftState;
    markers: RecordingMarker[];
    updatedAtMs: number;
};

function getDocumentDirectory(): string {
    if (!FileSystem.documentDirectory) {
        throw new Error('文件系统目录不可用');
    }
    return FileSystem.documentDirectory;
}

export function getRecordSessionDir(sessionId: string): string {
    const normalizedSessionId = sessionId.trim();
    return `${getDocumentDirectory()}${RECORDING_SESSION_ROOT}/${normalizedSessionId}/`;
}

export function getRecordSessionDraftPath(sessionId: string): string {
    return `${getRecordSessionDir(sessionId)}${RECORDING_DRAFT_FILE}`;
}

export async function saveRecordSessionDraft(draft: RecordSessionDraft): Promise<void> {
    const draftPath = getRecordSessionDraftPath(draft.sessionId);
    const sessionDir = getRecordSessionDir(draft.sessionId);
    await FileSystem.makeDirectoryAsync(sessionDir, { intermediates: true });
    await FileSystem.writeAsStringAsync(draftPath, JSON.stringify(draft), {
        encoding: FileSystem.EncodingType.UTF8,
    });
}

export async function loadRecordSessionDraft(sessionId: string): Promise<RecordSessionDraft | null> {
    const draftPath = getRecordSessionDraftPath(sessionId);
    const info = await FileSystem.getInfoAsync(draftPath);
    if (!info.exists) {
        return null;
    }
    const raw = await FileSystem.readAsStringAsync(draftPath, {
        encoding: FileSystem.EncodingType.UTF8,
    });
    if (!raw.trim()) {
        return null;
    }
    const parsed = JSON.parse(raw) as RecordSessionDraft;
    return {
        ...parsed,
        markers: Array.isArray(parsed.markers) ? parsed.markers : [],
    };
}

export async function listRecordSessionDrafts(): Promise<RecordSessionDraft[]> {
    const rootDir = `${getDocumentDirectory()}${RECORDING_SESSION_ROOT}/`;
    const rootInfo = await FileSystem.getInfoAsync(rootDir);
    if (!rootInfo.exists) {
        return [];
    }

    const sessionDirs = await FileSystem.readDirectoryAsync(rootDir);
    const drafts = await Promise.all(
        sessionDirs.map(async sessionId => {
            try {
                return await loadRecordSessionDraft(sessionId);
            } catch (error) {
                console.warn('[record-draft] load draft failed', {
                    sessionId,
                    message: (error as Error).message,
                });
                return null;
            }
        }),
    );
    return drafts.filter((draft): draft is RecordSessionDraft => Boolean(draft));
}

export async function deleteRecordSessionDraft(sessionId: string): Promise<void> {
    const draftPath = getRecordSessionDraftPath(sessionId);
    const info = await FileSystem.getInfoAsync(draftPath);
    if (!info.exists) {
        return;
    }
    await FileSystem.deleteAsync(draftPath, { idempotent: true });
}

export function formatRecordingDisplayName(ms: number): string {
    const date = new Date(ms);
    const year = `${date.getFullYear()}`;
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    const second = `${date.getSeconds()}`.padStart(2, '0');
    return `录音-${year}${month}${day}-${hour}${minute}${second}`;
}
