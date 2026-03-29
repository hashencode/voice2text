import * as FileSystem from 'expo-file-system/legacy';
import React from 'react';
import { deleteRecordingMeta, updateRecordingDisplayName } from '~/db/sqlite/services/recordings.service';

type FileItem = {
    path: string;
    displayName: string | null;
};

type ToastApi = {
    toast: (options: { title: string; description?: string; variant?: 'default' | 'success' | 'error' | 'warning' | 'info' }) => void;
};

type UseFileActionsParams = {
    items: FileItem[];
    selectedPaths: string[];
    selectedPathForRename: string | null;
    renameValue: string;
    validateName: (name: string) => string | null;
    extractFileName: (path: string) => string;
    toastApi: ToastApi;
    setItems: React.Dispatch<
        React.SetStateAction<
            {
                path: string;
                displayName: string | null;
                isFavorite: boolean;
                durationMs: number | null;
                recordedAtMs: number | null;
            }[]
        >
    >;
    setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
};

type RenameFileRuntime = {
    renaming: boolean;
    setRenaming: React.Dispatch<React.SetStateAction<boolean>>;
    setRenameError: (message: string) => void;
    setRenameValue: (value: string) => void;
    closeRenameDialog: () => void;
};

type DeleteFilesRuntime = {
    deleting: boolean;
    setDeleting: React.Dispatch<React.SetStateAction<boolean>>;
    closeDeleteDialog: () => void;
};

export function useFileActions({
    items,
    selectedPaths,
    selectedPathForRename,
    renameValue,
    validateName,
    extractFileName,
    toastApi,
    setItems,
    setSelectedPaths,
}: UseFileActionsParams) {
    const confirmRenameFile = React.useCallback(
        async ({ renaming, setRenaming, setRenameError, setRenameValue, closeRenameDialog }: RenameFileRuntime): Promise<boolean> => {
            if (renaming || !selectedPathForRename) {
                return false;
            }

            const sanitizedName = renameValue.replace(/\s+/g, '');
            const validationError = validateName(sanitizedName);
            if (validationError) {
                setRenameError(validationError);
                return false;
            }

            const duplicateExists = items.some(item => {
                if (item.path === selectedPathForRename) {
                    return false;
                }
                const existingName = (item.displayName?.trim() || extractFileName(item.path)).replace(/\s+/g, '');
                return existingName === sanitizedName;
            });
            if (duplicateExists) {
                setRenameError('名称已存在，请使用其他名称');
                return false;
            }

            try {
                setRenaming(true);
                setRenameError('');
                setRenameValue(sanitizedName);
                await updateRecordingDisplayName(selectedPathForRename, sanitizedName);
                setItems(prev => prev.map(item => (item.path === selectedPathForRename ? { ...item, displayName: sanitizedName } : item)));
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
        [extractFileName, items, renameValue, selectedPathForRename, setItems, toastApi, validateName],
    );

    const confirmDeleteFiles = React.useCallback(
        async ({ deleting, setDeleting, closeDeleteDialog }: DeleteFilesRuntime): Promise<boolean> => {
            if (deleting || selectedPaths.length === 0) {
                return false;
            }

            setDeleting(true);
            const deletedPaths: string[] = [];
            const failedPaths: string[] = [];

            try {
                for (const path of selectedPaths) {
                    try {
                        const fileInfo = await FileSystem.getInfoAsync(path);
                        if (fileInfo.exists) {
                            await FileSystem.deleteAsync(path);
                        }
                        await deleteRecordingMeta(path);
                        deletedPaths.push(path);
                    } catch {
                        failedPaths.push(path);
                    }
                }

                if (deletedPaths.length > 0) {
                    const deletedSet = new Set(deletedPaths);
                    setItems(prev => prev.filter(item => !deletedSet.has(item.path)));
                    setSelectedPaths(prev => prev.filter(path => !deletedSet.has(path)));
                }

                if (failedPaths.length > 0) {
                    toastApi.toast({
                        title: '删除未完全成功',
                        description: `${failedPaths.length} 个文件删除失败，请重试`,
                        variant: 'warning',
                    });
                } else {
                    toastApi.toast({
                        title: '删除成功',
                        description: `已删除 ${deletedPaths.length} 个文件`,
                        variant: 'success',
                    });
                }

                closeDeleteDialog();
                return true;
            } finally {
                setDeleting(false);
            }
        },
        [selectedPaths, setItems, setSelectedPaths, toastApi],
    );

    return {
        confirmRenameFile,
        confirmDeleteFiles,
    };
}
