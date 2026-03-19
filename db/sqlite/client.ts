import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const initSql = `
CREATE TABLE IF NOT EXISTS recordings (
  path TEXT PRIMARY KEY NOT NULL,
  sample_rate INTEGER,
  num_samples INTEGER,
  duration_ms INTEGER,
  recorded_at_ms INTEGER,
  session_id TEXT, 
  reason TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recordings_recorded_at ON recordings(recorded_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
`;

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(initSql);
}

export async function getSqliteDb(): Promise<SQLite.SQLiteDatabase> {
    if (!dbPromise) {
        dbPromise = (async () => {
            const db = await SQLite.openDatabaseAsync('recordings.db');
            await initSchema(db);
            return db;
        })();
    }
    return dbPromise;
}
