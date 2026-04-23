import { FolderInput, Heart, HeartOff, PencilLine, RotateCcw, Share2, Trash2 } from 'lucide-react-native';
import React from 'react';
import { ActionSheetOption } from '~/components/ui/action-sheet';
import { SYSTEM_GROUPS } from '~/data/sqlite/group-model';
import type { Folder } from '~/data/sqlite/services/folders.service';
import { restoreRecordingMeta, updateRecordingFavorite } from '~/data/sqlite/services/recordings.service';

type HomeRecordingItem = {
    path: string;
    displayName: string | null;
    groupName: string | null;
    deletedAtMs: number | null;
    isFavorite: boolean;
    durationMs: number | null;
    recordedAtMs: number | null;
};

type ToastApi = {
    toast: (options: { title: string; description?: string; variant?: 'default' | 'success' | 'error' | 'warning' | 'info' }) => void;
};

type UseSingleItemActionsParams = {
    items: HomeRecordingItem[];
    folders: Folder[];
    selectedGroupId: string;
    textColor: string;
    destructiveColor: string;
    showActionSheet: (params: { title: string; options: ActionSheetOption[]; cancelButtonTitle?: string }) => void;
    shareSingleFile: (selectedPaths: string[]) => Promise<void>;
    extractFileName: (path: string) => string;
    setSelectedPaths: React.Dispatch<React.SetStateAction<string[]>>;
    setDeleteDialogVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setRenameValue: React.Dispatch<React.SetStateAction<string>>;
    setRenameError: React.Dispatch<React.SetStateAction<string>>;
    setRenameDialogVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setItems: React.Dispatch<React.SetStateAction<HomeRecordingItem[]>>;
    toastApi: ToastApi;
};

export function useSingleItemActions({
    items,
    folders,
    selectedGroupId,
    textColor,
    destructiveColor,
    showActionSheet,
    shareSingleFile,
    extractFileName,
    setSelectedPaths,
    setDeleteDialogVisible,
    setRenameValue,
    setRenameError,
    setRenameDialogVisible,
    setItems,
    toastApi,
}: UseSingleItemActionsParams) {
    const openSingleActions = React.useCallback(
        (path: string) => {
            const target = items.find(item => item.path === path);
            if (!target) {
                toastApi.toast({ title: '目标已变化，请重试', variant: 'warning' });
                return;
            }

            const options: ActionSheetOption[] = [];
            if (selectedGroupId === SYSTEM_GROUPS.recentlyDeleted) {
                options.push({
                    title: '恢复',
                    icon: <RotateCcw size={18} color={textColor} />,
                    onPress: () => {
                        const customGroupExists = target.groupName ? folders.some(folder => folder.name === target.groupName) : false;
                        const restoredGroupName =
                            !target.groupName || target.groupName === SYSTEM_GROUPS.all || !customGroupExists ? null : target.groupName;
                        restoreRecordingMeta(target.path, restoredGroupName)
                            .then(() => {
                                setItems(prev => prev.filter(item => item.path !== target.path));
                                toastApi.toast({
                                    title: restoredGroupName ? '已恢复' : '原分组不存在，已恢复到全部录音',
                                    variant: 'success',
                                });
                            })
                            .catch(() => {
                                toastApi.toast({ title: '恢复失败，请重试', variant: 'error' });
                            });
                    },
                });
                options.push({
                    title: '彻底删除',
                    destructive: true,
                    icon: <Trash2 size={18} color={destructiveColor} />,
                    onPress: () => {
                        setSelectedPaths([target.path]);
                        setDeleteDialogVisible(true);
                    },
                });
            } else {
                const favoriteTitle = target.isFavorite ? '取消收藏' : '收藏';
                const favoriteIcon = target.isFavorite ? HeartOff : Heart;
                options.push(
                    {
                        title: '重命名',
                        icon: <PencilLine size={18} color={textColor} />,
                        onPress: () => {
                            setSelectedPaths([target.path]);
                            setRenameValue(target.displayName?.trim() || extractFileName(target.path));
                            setRenameError('');
                            setRenameDialogVisible(true);
                        },
                    },
                    {
                        title: '移动到',
                        icon: <FolderInput size={18} color={textColor} />,
                        onPress: () => {
                            toastApi.toast({ title: '移动功能即将上线', variant: 'info' });
                        },
                    },
                    {
                        title: favoriteTitle,
                        icon: React.createElement(favoriteIcon, { size: 18, color: textColor }),
                        onPress: () => {
                            updateRecordingFavorite(target.path, !target.isFavorite)
                                .then(() => {
                                    setItems(prev =>
                                        prev.map(item => (item.path === target.path ? { ...item, isFavorite: !target.isFavorite } : item)),
                                    );
                                    toastApi.toast({ title: !target.isFavorite ? '已收藏文件' : '已取消收藏文件', variant: 'success' });
                                })
                                .catch(() => {
                                    toastApi.toast({
                                        title: !target.isFavorite ? '收藏失败' : '取消收藏失败',
                                        description: '请稍后重试',
                                        variant: 'error',
                                    });
                                });
                        },
                    },
                    {
                        title: '分享',
                        icon: <Share2 size={18} color={textColor} />,
                        onPress: () => {
                            shareSingleFile([target.path]).catch(() => {});
                        },
                    },
                    {
                        title: '删除',
                        destructive: true,
                        icon: <Trash2 size={18} color={destructiveColor} />,
                        onPress: () => {
                            setSelectedPaths([target.path]);
                            setDeleteDialogVisible(true);
                        },
                    },
                );
            }

            showActionSheet({
                title: target.displayName?.trim() || extractFileName(target.path),
                options,
                cancelButtonTitle: '取消',
            });
        },
        [
            destructiveColor,
            extractFileName,
            folders,
            items,
            selectedGroupId,
            setDeleteDialogVisible,
            setItems,
            setRenameDialogVisible,
            setRenameError,
            setRenameValue,
            setSelectedPaths,
            shareSingleFile,
            showActionSheet,
            textColor,
            toastApi,
        ],
    );

    return {
        openSingleActions,
    };
}
