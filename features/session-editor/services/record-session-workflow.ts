import * as FileSystem from 'expo-file-system/legacy';
import {
    replaceRecordingMarkers,
    upsertRecordingMeta,
    type RecordingMarker,
    type RecordingMeta,
} from '~/data/sqlite/services/recordings.service';
import {
    deleteRecordSessionDraft,
    getRecordSessionDir,
    type RecordSessionDraft,
} from '~/features/session-editor/services/record-session-draft';
import SherpaOnnx from '~/modules/sherpa';

function normalizeMarkers(markers: RecordingMarker[], path: string, sessionId: string): RecordingMarker[] {
    return markers.map((marker, index) => ({
        recordingPath: path,
        sessionId,
        timeMs: Math.max(0, Math.floor(marker.timeMs)),
        noteText: marker.noteText?.trim() ?? '',
        sortOrder: index,
    }));
}

async function deleteIfExists(path: string): Promise<void> {
    if (!path) {
        return;
    }
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
        return;
    }
    await FileSystem.deleteAsync(path, { idempotent: true });
}

export async function finalizeRecordSessionDraft(draft: RecordSessionDraft): Promise<RecordingMeta> {
    const isActiveRecording = SherpaOnnx.isWavRecording();
    const stopped = isActiveRecording ? await SherpaOnnx.stopWavRecording() : null;
    const path = stopped?.path ?? draft.outputPath;
    const wavInfo =
        stopped === null
            ? await SherpaOnnx.getWavInfo(path)
            : {
                  sampleRate: stopped.sampleRate,
                  numSamples: stopped.numSamples,
                  durationMs: draft.durationMs,
              };

    const meta: RecordingMeta = {
        path,
        displayName: draft.displayName.trim() || null,
        groupName: draft.groupName?.trim() ?? null,
        noteRichText: draft.noteText,
        durationMs: draft.durationMs || wavInfo.durationMs,
        recordedAtMs: draft.recordedAtMs,
        sampleRate: wavInfo.sampleRate,
        numSamples: wavInfo.numSamples,
        sessionId: draft.sessionId,
        reason: 'record',
    };

    await upsertRecordingMeta(meta);

    if (draft.markers.length > 0) {
        await replaceRecordingMarkers(normalizeMarkers(draft.markers, path, draft.sessionId));
    }

    await deleteRecordSessionDraft(draft.sessionId);
    return meta;
}

export async function discardRecordSessionDraft(draft: RecordSessionDraft): Promise<void> {
    await deleteRecordSessionDraft(draft.sessionId);
    await SherpaOnnx.discardRecoverableWavRecordings([draft.sessionId]).catch(error => {
        console.warn('[record-review] discard recoverable session failed', error);
    });
    await deleteIfExists(draft.outputPath);
    await deleteIfExists(getRecordSessionDir(draft.sessionId));
}
