import { getSqliteDb } from '~/db/sqlite/client';
import type { RecordingMeta, RecordingMetaRow } from '~/db/sqlite/types';

function toMeta(row: RecordingMetaRow): RecordingMeta {
    return {
        path: row.path,
        displayName: row.display_name,
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
        'SELECT path, display_name, sample_rate, num_samples, duration_ms, recorded_at_ms, session_id, reason FROM recordings ORDER BY recorded_at_ms DESC, path DESC',
    );
    return rows.map(toMeta);
}

export async function upsertRecordingMeta(meta: RecordingMeta): Promise<void> {
    const db = await getSqliteDb();
    const now = Date.now();
    await db.runAsync(
        `INSERT INTO recordings (
            path, display_name, sample_rate, num_samples, duration_ms, recorded_at_ms, session_id, reason, created_at_ms, updated_at_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
            display_name=COALESCE(excluded.display_name, recordings.display_name),
            sample_rate=excluded.sample_rate,
            num_samples=excluded.num_samples,
            duration_ms=excluded.duration_ms,
            recorded_at_ms=excluded.recorded_at_ms,
            session_id=excluded.session_id,
            reason=excluded.reason,
            updated_at_ms=excluded.updated_at_ms`,
        meta.path,
        meta.displayName ?? null,
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

export async function deleteRecordingMeta(path: string): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('DELETE FROM recordings WHERE path = ?', path);
}

export async function hasRecordingSession(sessionId: string): Promise<boolean> {
    if (!sessionId) {
        return false;
    }
    const db = await getSqliteDb();
    const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(1) AS count FROM recordings WHERE session_id = ?', sessionId);
    return (row?.count ?? 0) > 0;
}
