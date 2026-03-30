import { getSqliteDb } from '~/db/sqlite/client';
import type { Folder, FolderRow } from '~/db/sqlite/types';

function toFolder(row: FolderRow): Folder {
    return {
        name: row.name,
        createdAtMs: row.created_at_ms,
        isFavorite: row.is_favorite === 1,
    };
}

export async function listFolders(): Promise<Folder[]> {
    const db = await getSqliteDb();
    const rows = await db.getAllAsync<FolderRow>(
        'SELECT name, created_at_ms, is_favorite FROM folders ORDER BY created_at_ms DESC, name ASC',
    );
    return rows.map(toFolder);
}

export async function createFolder(name: string): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('INSERT INTO folders (name, created_at_ms, is_favorite) VALUES (?, ?, 0)', name, Date.now());
}

export async function updateFolderName(oldName: string, newName: string): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('UPDATE folders SET name = ? WHERE name = ?', newName, oldName);
}

export async function deleteFolder(name: string): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('DELETE FROM folders WHERE name = ?', name);
}

export async function updateFolderFavorite(name: string, isFavorite: boolean): Promise<void> {
    const db = await getSqliteDb();
    await db.runAsync('UPDATE folders SET is_favorite = ? WHERE name = ?', isFavorite ? 1 : 0, name);
}
