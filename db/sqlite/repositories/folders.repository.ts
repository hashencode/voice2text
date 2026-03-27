import { getSqliteDb } from '~/db/sqlite/client';
import type { Folder, FolderRow } from '~/db/sqlite/types';

function toFolder(row: FolderRow): Folder {
    return {
        name: row.name,
        createdAtMs: row.created_at_ms,
    };
}

export async function listFolders(): Promise<Folder[]> {
    const db = await getSqliteDb();
    const rows = await db.getAllAsync<FolderRow>('SELECT name, created_at_ms FROM folders ORDER BY created_at_ms DESC, name ASC');
    return rows.map(toFolder);
}

export async function createFolder(name: string): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('INSERT INTO folders (name, created_at_ms) VALUES (?, ?)', name, Date.now());
}
