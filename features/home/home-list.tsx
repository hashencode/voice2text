import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCheck, FolderInput, Heart, HeartOff, PencilLine, RotateCcw, Share2, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionSheetOption, useActionSheet } from '~/components/ui/action-sheet';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { CommonEmptyState } from '~/components/ui/common-empty-state';
import { IconButton } from '~/components/ui/icon-button';
import { PullToRefreshScrollView } from '~/components/ui/pull-to-refresh-scrollview';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { getSelectedRecordingGroupId, setCurrentRecordingFolderName, setSelectedRecordingGroupId } from '~/data/mmkv/app-config';
import { getGroupLabel, isSystemGroupId, SYSTEM_GROUPS } from '~/data/sqlite/group-model';
import type { Folder } from '~/data/sqlite/services/folders.service';
import { listFolders } from '~/data/sqlite/services/folders.service';
import {
    hardDeleteRecordingMeta,
    listActiveRecordingMetaOverview,
    listDeletedRecordingMetaOverview,
    restoreRecordingMeta,
    softDeleteRecordingMeta,
    updateRecordingDisplayName,
    updateRecordingFavorite,
} from '~/data/sqlite/services/recordings.service';
import NameInputDialog from '~/features/home/common/name-input-dialog';
import FileListView from '~/features/home/file-list/file-list-view';
import { useFileSelection } from '~/features/home/hooks/use-file-selection';
import { useItemActions } from '~/features/home/hooks/use-item-actions';
import { useColor } from '~/hooks/useColor';

type HomeRecordingItem = {
    path: string;
    displayName: string | null;
    groupName: string | null;
    deletedAtMs: number | null;
    isFavorite: boolean;
    durationMs: number | null;
    recordedAtMs: number | null;
};

type ActionMenuItem = {
    key: 'move' | 'share' | 'delete';
    label: string;
    icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    disabled: boolean;
};

function ActionMenuButton({
    action,
    textColor,
    onPress,
}: {
    action: ActionMenuItem;
    textColor: string;
    onPress: (key: ActionMenuItem['key']) => void;
}) {
    return (
        <Pressable
            onPress={() => onPress(action.key)}
            disabled={action.disabled}
            className={`flex-1 items-center justify-center gap-y-1.5 rounded-xl ${action.disabled ? 'opacity-50' : ''}`}>
            <action.icon size={26} color={textColor} strokeWidth={1.5} />
            <TextX className="!text-sm">{action.label}</TextX>
        </Pressable>
    );
}

function extractFileName(path: string): string {
    const name = path.split('/').pop() ?? path;
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex <= 0) {
        return name;
    }
    return name.slice(0, dotIndex);
}

function normalizeGroupNameForWrite(groupId: string): string | null {
    if (groupId === SYSTEM_GROUPS.all || groupId === SYSTEM_GROUPS.recentlyDeleted) {
        return null;
    }
    return groupId;
}

export default function HomeList() {
    const router = useRouter();
    const { toast } = useToast();
    const insets = useSafeAreaInsets();
    const [items, setItems] = React.useState<HomeRecordingItem[]>([]);
    const [folders, setFolders] = React.useState<Folder[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>(() => getSelectedRecordingGroupId());
    const [isMultiSelectMode, setIsMultiSelectMode] = React.useState(false);
    const [renameDialogVisible, setRenameDialogVisible] = React.useState(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = React.useState(false);
    const [renameValue, setRenameValue] = React.useState('');
    const [renameError, setRenameError] = React.useState('');
    const [renaming, setRenaming] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    const textColor = useColor('text');
    const destructiveColor = useColor('red');
    const cardColor = useColor('card');
    const borderColor = useColor('border');
    const secondaryColor = useColor('secondary');

    const { sharing, shareSingleFile } = useItemActions({ toastApi: { toast } });
    const { show: showActionSheet, ActionSheet, isVisible: isActionSheetVisible } = useActionSheet();

    const refreshList = React.useCallback(
        async (mode: 'focus' | 'pull' = 'focus') => {
            if (mode === 'focus') {
                setLoading(true);
            }
            try {
                const [rows, folderRows] = await Promise.all([
                    selectedGroupId === SYSTEM_GROUPS.recentlyDeleted
                        ? listDeletedRecordingMetaOverview()
                        : selectedGroupId === SYSTEM_GROUPS.all
                          ? listActiveRecordingMetaOverview()
                          : listActiveRecordingMetaOverview(selectedGroupId),
                    listFolders(),
                ]);
                setItems(
                    rows.map(item => ({
                        path: item.path,
                        displayName: item.displayName ?? null,
                        groupName: item.groupName ?? null,
                        deletedAtMs: item.deletedAtMs ?? null,
                        isFavorite: item.isFavorite === true,
                        durationMs: item.durationMs,
                        recordedAtMs: item.recordedAtMs,
                    })),
                );
                setFolders(folderRows);
            } catch (error) {
                setItems([]);
                setFolders([]);
                if (mode === 'pull') {
                    throw error;
                }
            } finally {
                if (mode === 'focus') {
                    setLoading(false);
                }
            }
        },
        [selectedGroupId],
    );

    useFocusEffect(
        React.useCallback(() => {
            refreshList('focus').catch(() => {
                setItems([]);
                setLoading(false);
            });
        }, [refreshList]),
    );

    React.useEffect(() => {
        refreshList('focus').catch(() => {
            setItems([]);
            setLoading(false);
        });
    }, [refreshList]);

    React.useEffect(() => {
        setSelectedRecordingGroupId(selectedGroupId);
        const folderName = normalizeGroupNameForWrite(selectedGroupId);
        setCurrentRecordingFolderName(folderName);
    }, [selectedGroupId]);

    const groupTabs = React.useMemo(() => {
        const customGroups = folders.map(folder => folder.name.trim()).filter(name => name && !isSystemGroupId(name));

        return [SYSTEM_GROUPS.all, SYSTEM_GROUPS.meeting, ...customGroups, SYSTEM_GROUPS.recentlyDeleted];
    }, [folders]);

    const onPullRefresh = React.useCallback(() => refreshList('pull'), [refreshList]);

    const {
        selectedPaths,
        setSelectedPaths,
        toggleSelectPath,
        clearSelectedPaths,
        addSelectedPath,
        isAllFilteredSelected,
        toggleSelectAllFiltered,
    } = useFileSelection(items.map(item => item.path));

    const selectedCount = selectedPaths.length;
    const selectedPathForRename = selectedCount === 1 ? selectedPaths[0] : null;
    const validateRenameName = React.useCallback((name: string): string | null => {
        if (!name) {
            return '名称不能为空';
        }
        if (name.length > 255) {
            return '名称过长，请控制在 255 个字符以内';
        }
        if (/[/\\:*?"<>|\u0000-\u001F]/.test(name)) {
            return '名称包含非法字符（\\ / : * ? " < > |）';
        }
        if (/[.\s]$/.test(name)) {
            return '名称不能以空格或英文句点结尾';
        }
        if (name === '.' || name === '..') {
            return '名称不合法';
        }
        return null;
    }, []);

    const handleToggleMultiSelectMode = React.useCallback(() => {
        setIsMultiSelectMode(prev => !prev);
        clearSelectedPaths();
    }, [clearSelectedPaths]);

    const enterMultiSelectWithItem = React.useCallback(
        (path: string) => {
            if (isActionSheetVisible) {
                return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setIsMultiSelectMode(true);
            addSelectedPath(path);
        },
        [addSelectedPath, isActionSheetVisible],
    );

    const openSingleActions = React.useCallback(
        (path: string) => {
            const target = items.find(item => item.path === path);
            if (!target) {
                toast({ title: '目标已变化，请重试', variant: 'warning' });
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
                                toast({
                                    title: restoredGroupName ? '已恢复' : '原分组不存在，已恢复到全部录音',
                                    variant: 'success',
                                });
                            })
                            .catch(() => {
                                toast({ title: '恢复失败，请重试', variant: 'error' });
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
                            toast({ title: '移动功能即将上线', variant: 'info' });
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
                                    toast({ title: !target.isFavorite ? '已收藏文件' : '已取消收藏文件', variant: 'success' });
                                })
                                .catch(() => {
                                    toast({
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
        [destructiveColor, folders, items, selectedGroupId, setSelectedPaths, shareSingleFile, showActionSheet, textColor, toast],
    );

    const performDelete = React.useCallback(async (): Promise<boolean> => {
        if (deleting || selectedPaths.length === 0) {
            return false;
        }

        setDeleting(true);
        const deletedPaths: string[] = [];
        const failedPaths: string[] = [];

        try {
            for (const path of selectedPaths) {
                try {
                    if (selectedGroupId === SYSTEM_GROUPS.recentlyDeleted) {
                        const fileInfo = await FileSystem.getInfoAsync(path);
                        if (fileInfo.exists) {
                            await FileSystem.deleteAsync(path);
                        }
                        await hardDeleteRecordingMeta(path);
                    } else {
                        await softDeleteRecordingMeta(path);
                    }
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
                toast({
                    title: '删除未完全成功',
                    description: `${failedPaths.length} 个文件删除失败，请重试`,
                    variant: 'warning',
                });
            } else {
                toast({
                    title: selectedGroupId === SYSTEM_GROUPS.recentlyDeleted ? '已彻底删除' : '已移入最近删除',
                    description: `已处理 ${deletedPaths.length} 个文件`,
                    variant: 'success',
                });
            }
            return true;
        } finally {
            setDeleting(false);
        }
    }, [deleting, selectedGroupId, selectedPaths, setSelectedPaths, toast]);

    const handleConfirmRename = React.useCallback(async (): Promise<boolean> => {
        if (renaming || !selectedPathForRename) {
            return false;
        }
        const sanitizedName = renameValue.trim();
        const validationError = validateRenameName(sanitizedName);
        if (validationError) {
            setRenameError(validationError);
            return false;
        }
        const duplicateExists = items.some(item => {
            if (item.path === selectedPathForRename) {
                return false;
            }
            const existingName = (item.displayName?.trim() || extractFileName(item.path)).toLowerCase();
            return existingName === sanitizedName.toLowerCase();
        });
        if (duplicateExists) {
            setRenameError('名称已存在，请使用其他名称');
            return false;
        }

        setRenaming(true);
        try {
            await updateRecordingDisplayName(selectedPathForRename, sanitizedName);
            setItems(prev => prev.map(item => (item.path === selectedPathForRename ? { ...item, displayName: sanitizedName } : item)));
            setRenameDialogVisible(false);
            clearSelectedPaths();
            toast({ title: '重命名成功', variant: 'success' });
            return true;
        } catch {
            setRenameError('保存名称时发生错误，请稍后重试');
            return false;
        } finally {
            setRenaming(false);
        }
    }, [clearSelectedPaths, items, renameValue, renaming, selectedPathForRename, toast, validateRenameName]);

    const deleteDialogDescription =
        selectedGroupId === SYSTEM_GROUPS.recentlyDeleted
            ? `是否彻底删除已选中的 ${Math.max(selectedCount, 1)} 个文件？删除后无法恢复。`
            : `是否将已选中的 ${Math.max(selectedCount, 1)} 个文件移入最近删除？`;

    const actionMenuActions: ActionMenuItem[] = [
        { key: 'move', label: '移动到', icon: FolderInput, disabled: selectedCount === 0 },
        { key: 'share', label: '分享', icon: Share2, disabled: selectedCount === 0 || sharing },
        {
            key: 'delete',
            label: selectedGroupId === SYSTEM_GROUPS.recentlyDeleted ? '彻底删除' : '删除',
            icon: Trash2,
            disabled: selectedCount === 0,
        },
    ];

    const handleMultiActionPress = React.useCallback(
        (actionKey: ActionMenuItem['key']) => {
            if (actionKey === 'move') {
                toast({ title: '移动功能即将上线', variant: 'info' });
                return;
            }
            if (actionKey === 'share') {
                shareSingleFile(selectedPaths).catch(() => {});
                return;
            }
            if (actionKey === 'delete') {
                setDeleteDialogVisible(true);
            }
        },
        [selectedPaths, shareSingleFile, toast],
    );

    React.useEffect(() => {
        if (!isMultiSelectMode || items.length > 0) {
            return;
        }
        setIsMultiSelectMode(false);
        clearSelectedPaths();
    }, [clearSelectedPaths, isMultiSelectMode, items.length]);

    return (
        <View className="flex-1">
            <View className="rounded-t-3xl px-4 py-3" style={{ backgroundColor: cardColor }}>
                {isMultiSelectMode ? (
                    <View className="flex-row items-center justify-between gap-x-2">
                        <TextX variant="title" numberOfLines={1} className="flex-1">
                            {selectedCount <= 0 ? '请选择文件' : `已选择 ${selectedCount} 个文件`}
                        </TextX>
                        <View className="h-9 flex-row items-center gap-x-2">
                            <IconButton
                                icon={CheckCheck}
                                size="sm"
                                backgroundColor={secondaryColor}
                                disabled={items.length === 0}
                                onPress={toggleSelectAllFiltered}
                                active={isAllFilteredSelected}
                            />
                            <IconButton icon={X} size="sm" backgroundColor={secondaryColor} onPress={handleToggleMultiSelectMode} />
                        </View>
                    </View>
                ) : (
                    <View className="flex-row items-center gap-x-2">
                        <IconButton
                            icon={FolderInput}
                            size="sm"
                            backgroundColor={secondaryColor}
                            onPress={() => router.push('/recording-groups' as never)}
                        />
                        <View className="flex-1">
                            <Tabs value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                <TabsList scrollable radius={12}>
                                    {groupTabs.map(groupId => (
                                        <TabsTrigger key={groupId} value={groupId} fullWidth={false}>
                                            {getGroupLabel(groupId)}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </View>
                    </View>
                )}
            </View>

            <PullToRefreshScrollView
                onRefresh={onPullRefresh}
                isEmpty={!loading && items.length === 0}
                emptyText={null}
                isLoadedAll={!loading && items.length > 0}
                contentContainerStyle={{ paddingBottom: isMultiSelectMode && selectedCount > 0 ? 96 + insets.bottom : 12 }}>
                {items.length > 0 ? (
                    <FileListView
                        items={items}
                        isMultiSelectMode={isMultiSelectMode}
                        selectedPaths={selectedPaths}
                        extractFileName={extractFileName}
                        onToggleSelectPath={toggleSelectPath}
                        onEnterMultiSelectWithItem={enterMultiSelectWithItem}
                        onOpenSingleActionForItem={openSingleActions}
                        onOpenItem={item => {
                            const initialName = item.displayName ?? extractFileName(item.path);
                            router.push({
                                pathname: '/import-audio',
                                params: {
                                    uri: item.path,
                                    name: initialName,
                                    recordedAtMs: item.recordedAtMs ? String(item.recordedAtMs) : undefined,
                                    source: 'list',
                                },
                            });
                        }}
                    />
                ) : (
                    <CommonEmptyState text={selectedGroupId === SYSTEM_GROUPS.recentlyDeleted ? '最近删除为空' : '暂无录音文件'} />
                )}
            </PullToRefreshScrollView>

            {isMultiSelectMode && selectedCount > 0 ? (
                <View className="absolute bottom-0 left-0 right-0" style={{ backgroundColor: cardColor }}>
                    <View className="border-t pb-4 pt-4" style={{ borderTopColor: borderColor }}>
                        <View className="flex-row justify-between">
                            {actionMenuActions.map(action => (
                                <ActionMenuButton key={action.key} action={action} textColor={textColor} onPress={handleMultiActionPress} />
                            ))}
                        </View>
                        <BottomSafeAreaSpacer />
                    </View>
                </View>
            ) : null}

            <NameInputDialog
                isVisible={renameDialogVisible}
                onClose={() => {
                    setRenameDialogVisible(false);
                    setRenameError('');
                    clearSelectedPaths();
                }}
                title="重命名文件"
                description="只修改显示名称，不会修改原始文件名。"
                value={renameValue}
                error={renameError}
                placeholder="输入新的文件名"
                isSubmitting={renaming}
                onChangeText={text => {
                    setRenameValue(text);
                    if (renameError) {
                        const validationError = validateRenameName(text.trim());
                        setRenameError(validationError ?? '');
                    }
                }}
                onConfirm={handleConfirmRename}
            />

            <AlertDialog
                isVisible={deleteDialogVisible}
                onClose={() => {
                    if (deleting) {
                        return;
                    }
                    setDeleteDialogVisible(false);
                    clearSelectedPaths();
                }}
                title={selectedGroupId === SYSTEM_GROUPS.recentlyDeleted ? '确认彻底删除' : '确认删除'}
                confirmText={selectedGroupId === SYSTEM_GROUPS.recentlyDeleted ? '彻底删除' : '确认删除'}
                cancelText="取消"
                confirmButtonProps={{ variant: 'destructive', disabled: deleting }}
                cancelButtonProps={{ disabled: deleting }}
                onConfirm={async () => {
                    const done = await performDelete();
                    if (done) {
                        setDeleteDialogVisible(false);
                    }
                    return done;
                }}>
                <TextX>{deleteDialogDescription}</TextX>
            </AlertDialog>

            {ActionSheet}
        </View>
    );
}
