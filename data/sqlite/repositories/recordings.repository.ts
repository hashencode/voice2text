import { getSqliteDb } from '~/data/sqlite/client';
import type { RecordingMeta, RecordingMetaRow } from '~/data/sqlite/types';

function toMeta(row: RecordingMetaRow): RecordingMeta {
    return {
        path: row.path,
        displayName: row.display_name,
        isFavorite: row.is_favorite === 1,
        sourceFileName: row.source_file_name,
        sha256: row.sha256,
        noteRichText: row.note_rich_text,
        transcriptText: row.transcript_text,
        summaryText: row.summary_text,
        sampleRate: row.sample_rate,
        numSamples: row.num_samples,
        durationMs: row.duration_ms,
        recordedAtMs: row.recorded_at_ms,
        sessionId: row.session_id,
        reason: row.reason,
    };
}

export async function listRecordingMeta(): Promise<RecordingMeta[]> {
    const db = await getSqliteDb();
    const rows = await db.getAllAsync<RecordingMetaRow>(
        'SELECT path, display_name, is_favorite, source_file_name, sha256, note_rich_text, transcript_text, summary_text, sample_rate, num_samples, duration_ms, recorded_at_ms, session_id, reason FROM recordings ORDER BY recorded_at_ms DESC, path DESC',
    );
    return rows.map(toMeta);
}

export async function upsertRecordingMeta(meta: RecordingMeta): Promise<void> {
    const db = await getSqliteDb();
    const now = Date.now();
    await db.runAsync(
        `INSERT INTO recordings (
            path, display_name, is_favorite, source_file_name, sha256, note_rich_text, transcript_text, summary_text, sample_rate, num_samples, duration_ms, recorded_at_ms, session_id, reason, created_at_ms, updated_at_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
            display_name=COALESCE(excluded.display_name, recordings.display_name),
            is_favorite=COALESCE(excluded.is_favorite, recordings.is_favorite),
            source_file_name=COALESCE(excluded.source_file_name, recordings.source_file_name),
            sha256=COALESCE(excluded.sha256, recordings.sha256),
            note_rich_text=COALESCE(excluded.note_rich_text, recordings.note_rich_text),
            transcript_text=COALESCE(excluded.transcript_text, recordings.transcript_text),
            summary_text=COALESCE(excluded.summary_text, recordings.summary_text),
            sample_rate=excluded.sample_rate,
            num_samples=excluded.num_samples,
            duration_ms=excluded.duration_ms,
            recorded_at_ms=excluded.recorded_at_ms,
            session_id=excluded.session_id,
            reason=excluded.reason,
            updated_at_ms=excluded.updated_at_ms`,
        meta.path,
        meta.displayName ?? null,
        meta.isFavorite ? 1 : 0,
        meta.sourceFileName ?? null,
        meta.sha256 ?? null,
        meta.noteRichText ?? null,
        meta.transcriptText ?? null,
        meta.summaryText ?? null,
        meta.sampleRate,
        meta.numSamples,
        meta.durationMs,
        meta.recordedAtMs,
        meta.sessionId ?? null,
        meta.reason ?? null,
        now,
        now,
    );
}

export async function updateRecordingDisplayName(path: string, displayName: string | null): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('UPDATE recordings SET display_name = ?, updated_at_ms = ? WHERE path = ?', displayName, Date.now(), path);
}

export async function updateRecordingFavorite(path: string, isFavorite: boolean): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('UPDATE recordings SET is_favorite = ?, updated_at_ms = ? WHERE path = ?', isFavorite ? 1 : 0, Date.now(), path);
}

export async function deleteRecordingMeta(path: string): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('DELETE FROM recordings WHERE path = ?', path);
}

export async function findRecordingMetaBySourceFileNameAndSha256(sourceFileName: string, sha256: string): Promise<RecordingMeta | null> {
    const normalizedSourceName = sourceFileName.trim().toLowerCase();
    const normalizedSha256 = sha256.trim().toLowerCase();
    if (!normalizedSourceName || !normalizedSha256) {
        return null;
    }
    const db = await getSqliteDb();
    const row = await db.getFirstAsync<RecordingMetaRow>(
        `SELECT path, display_name, is_favorite, source_file_name, sha256, note_rich_text, transcript_text, summary_text, sample_rate, num_samples, duration_ms, recorded_at_ms, session_id, reason
         FROM recordings
         WHERE lower(trim(source_file_name)) = ? AND lower(trim(sha256)) = ?
         ORDER BY updated_at_ms DESC, recorded_at_ms DESC
         LIMIT 1`,
        normalizedSourceName,
        normalizedSha256,
    );
    return row ? toMeta(row) : null;
}

export async function hasRecordingSession(sessionId: string): Promise<boolean> {
    if (!sessionId) {
        return false;
    }
    const db = await getSqliteDb();
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(1) AS count FROM recordings WHERE session_id = ?', sessionId);
    return (row?.count ?? 0) > 0;
}
