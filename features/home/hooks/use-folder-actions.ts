import React from 'react';
import { createFolder, deleteFolder, updateFolderName } from '~/data/sqlite/services/folders.service';

type FolderItem = {
    name: string;
    createdAtMs: number;
    isFavorite: boolean;
};

type ToastApi = {
    toast: (options: { title: string; description?: string; variant?: 'default' | 'success' | 'error' | 'warning' | 'info' }) => void;
};

type UseFolderActionsParams = {
    allFoldersKey: string;
    folders: FolderItem[];
    selectedFolder: string;
    selectedFolderNames: string[];
    renameValue: string;
    createFolderValue: string;
    validateName: (name: string) => string | null;
    toastApi: ToastApi;
    setFolders: React.Dispatch<React.SetStateAction<FolderItem[]>>;
    setSelectedFolder: React.Dispatch<React.SetStateAction<string>>;
    setSelectedFolderNames: React.Dispatch<React.SetStateAction<string[]>>;
};

type RenameFolderRuntime = {
    renaming: boolean;
    selectedFolderNameForRename: string | null;
    setRenaming: React.Dispatch<React.SetStateAction<boolean>>;
    setRenameError: (message: string) => void;
    closeRenameDialog: () => void;
};

type CreateFolderRuntime = {
    creatingFolder: boolean;
    setCreatingFolder: React.Dispatch<React.SetStateAction<boolean>>;
    setCreateFolderError: (message: string) => void;
    closeCreateDialog: () => void;
};

type DeleteFoldersRuntime = {
    deleting: boolean;
    setDeleting: React.Dispatch<React.SetStateAction<boolean>>;
    closeDeleteDialog: () => void;
};

export function useFolderActions({
    allFoldersKey,
    folders,
    selectedFolder,
    selectedFolderNames,
    renameValue,
    createFolderValue,
    validateName,
    toastApi,
    setFolders,
    setSelectedFolder,
    setSelectedFolderNames,
}: UseFolderActionsParams) {
    const confirmRenameFolder = React.useCallback(
        async ({
            renaming,
            selectedFolderNameForRename,
            setRenaming,
            setRenameError,
            closeRenameDialog,
        }: RenameFolderRuntime): Promise<boolean> => {
            if (renaming || !selectedFolderNameForRename) {
                return false;
            }

            const sanitizedName = renameValue.replace(/\s+/g, '');
            const validationError = validateName(sanitizedName);
            if (validationError) {
                setRenameError(validationError);
                return false;
            }
            if (selectedFolderNameForRename === allFoldersKey) {
                setRenameError('默认文件夹不可重命名');
                return false;
            }
            if (folders.some(folder => folder.name !== selectedFolderNameForRename && folder.name.replace(/\s+/g, '') === sanitizedName)) {
                setRenameError('文件夹名称已存在，请使用其他名称');
                return false;
            }

            try {
                setRenaming(true);
                setRenameError('');
                await updateFolderName(selectedFolderNameForRename, sanitizedName);
                setFolders(prev =>
                    prev
                        .map(folder =>
                            folder.name === selectedFolderNameForRename
                                ? {
                                      ...folder,
                                      name: sanitizedName,
                                  }
                                : folder,
                        )
                        .sort((a, b) => b.createdAtMs - a.createdAtMs),
                );
                setSelectedFolderNames(prev => prev.map(name => (name === selectedFolderNameForRename ? sanitizedName : name)));
                if (selectedFolder === selectedFolderNameForRename) {
                    setSelectedFolder(sanitizedName);
                }
                toastApi.toast({
                    title: '重命名成功',
                    variant: 'success',
                });
                closeRenameDialog();
                return true;
            } catch {
                setRenameError('保存名称时发生错误，请稍后重试');
                return false;
            } finally {
                setRenaming(false);
            }
        },
        [
            allFoldersKey,
            folders,
            renameValue,
            selectedFolder,
            setFolders,
            setSelectedFolder,
            setSelectedFolderNames,
            toastApi,
            validateName,
        ],
    );

    const confirmCreateFolder = React.useCallback(
        async ({ creatingFolder, setCreatingFolder, setCreateFolderError, closeCreateDialog }: CreateFolderRuntime): Promise<boolean> => {
            if (creatingFolder) {
                return false;
            }

            const sanitizedName = createFolderValue.replace(/\s+/g, '');
            const validationError = validateName(sanitizedName);
            if (validationError) {
                setCreateFolderError(validationError);
                return false;
            }
            if (folders.some(folder => folder.name.replace(/\s+/g, '') === sanitizedName)) {
                setCreateFolderError('文件夹名称已存在，请使用其他名称');
                return false;
            }

            try {
                setCreatingFolder(true);
                setCreateFolderError('');
                const now = Date.now();
                await createFolder(sanitizedName);
                setFolders(prev =>
                    [...prev, { name: sanitizedName, createdAtMs: now, isFavorite: false }].sort((a, b) => b.createdAtMs - a.createdAtMs),
                );
                closeCreateDialog();
                toastApi.toast({
                    title: '创建文件夹成功',
                    variant: 'success',
                });
                return true;
            } catch {
                setCreateFolderError('创建文件夹失败，请稍后重试');
                return false;
            } finally {
                setCreatingFolder(false);
            }
        },
        [createFolderValue, folders, setFolders, toastApi, validateName],
    );

    const confirmDeleteFolders = React.useCallback(
        async ({ deleting, setDeleting, closeDeleteDialog }: DeleteFoldersRuntime): Promise<boolean> => {
            if (deleting || selectedFolderNames.length === 0) {
                return false;
            }

            setDeleting(true);
            const deletedNames: string[] = [];
            const failedNames: string[] = [];

            try {
                for (const name of selectedFolderNames) {
                    try {
                        await deleteFolder(name);
                        deletedNames.push(name);
                    } catch {
                        failedNames.push(name);
                    }
                }

                if (deletedNames.length > 0) {
                    const deletedSet = new Set(deletedNames);
                    setFolders(prev => prev.filter(folder => !deletedSet.has(folder.name)));
                    setSelectedFolderNames(prev => prev.filter(name => !deletedSet.has(name)));
                    if (deletedSet.has(selectedFolder)) {
                        setSelectedFolder(allFoldersKey);
                    }
                }

                if (failedNames.length > 0) {
                    toastApi.toast({
                        title: '删除未完全成功',
                        description: `${failedNames.length} 个文件夹删除失败，请重试`,
                        variant: 'warning',
                    });
                } else {
                    toastApi.toast({
                        title: '删除成功',
                        description: `已删除 ${deletedNames.length} 个文件夹`,
                        variant: 'success',
                    });
                }

                closeDeleteDialog();
                return true;
            } finally {
                setDeleting(false);
            }
        },
        [allFoldersKey, selectedFolder, selectedFolderNames, setFolders, setSelectedFolder, setSelectedFolderNames, toastApi],
    );

    return {
        confirmRenameFolder,
        confirmCreateFolder,
        confirmDeleteFolders,
    };
}
