import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const initSql = `
CREATE TABLE IF NOT EXISTS recordings (
  path TEXT PRIMARY KEY NOT NULL,
  display_name TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  source_file_name TEXT,
  sha256 TEXT,
  note_rich_text TEXT,
  transcript_text TEXT,
  summary_text TEXT,
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
CREATE TABLE IF NOT EXISTS folders (
  name TEXT PRIMARY KEY NOT NULL,
  created_at_ms INTEGER NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0
);
`;

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(initSql);
    const recordingsTableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(recordings)');
    const hasDisplayNameColumn = recordingsTableInfo.some(column => column.name === 'display_name');
    if (!hasDisplayNameColumn) {
        await db.execAsync('ALTER TABLE recordings ADD COLUMN display_name TEXT;');
    }
    const hasRecordingFavoriteColumn = recordingsTableInfo.some(column => column.name === 'is_favorite');
    if (!hasRecordingFavoriteColumn) {
        await db.execAsync('ALTER TABLE recordings ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;');
    }
    const hasSourceFileNameColumn = recordingsTableInfo.some(column => column.name === 'source_file_name');
    if (!hasSourceFileNameColumn) {
        await db.execAsync('ALTER TABLE recordings ADD COLUMN source_file_name TEXT;');
    }
    const hasSha256Column = recordingsTableInfo.some(column => column.name === 'sha256');
    if (!hasSha256Column) {
        await db.execAsync('ALTER TABLE recordings ADD COLUMN sha256 TEXT;');
    }
    const hasNoteRichTextColumn = recordingsTableInfo.some(column => column.name === 'note_rich_text');
    if (!hasNoteRichTextColumn) {
        await db.execAsync('ALTER TABLE recordings ADD COLUMN note_rich_text TEXT;');
    }
    const hasTranscriptTextColumn = recordingsTableInfo.some(column => column.name === 'transcript_text');
    if (!hasTranscriptTextColumn) {
        await db.execAsync('ALTER TABLE recordings ADD COLUMN transcript_text TEXT;');
    }
    const hasSummaryTextColumn = recordingsTableInfo.some(column => column.name === 'summary_text');
    if (!hasSummaryTextColumn) {
        await db.execAsync('ALTER TABLE recordings ADD COLUMN summary_text TEXT;');
    }
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_recordings_source_file_name ON recordings(source_file_name);');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_recordings_sha256 ON recordings(sha256);');

    const foldersTableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(folders)');
    const hasFolderFavoriteColumn = foldersTableInfo.some(column => column.name === 'is_favorite');
    if (!hasFolderFavoriteColumn) {
        await db.execAsync('ALTER TABLE folders ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;');
    }
}

export async function getSqliteDb(): Promise<SQLite.SQLiteDatabase> {
    if (!dbPromise) {
        dbPromise = (async () => {
            try {
                const db = await SQLite.openDatabaseAsync('recordings.db');
                await initSchema(db);
                return db;
            } catch (error) {
                dbPromise = null;
                throw error;
            }
        })();
    }
    return dbPromise;
}
