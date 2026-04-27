import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { CassetteTape } from 'lucide-react-native';
import React from 'react';
import { FlatList, ListRenderItemInfo, View } from 'react-native';
import SelectionModeLayout, { BOTTOM_TOOLBAR_HEIGHT, type SelectionModeActionType } from '~/components/layout/selection-mode-layout';
import { useActionSheet } from '~/components/ui/action-sheet';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { CommonEmptyState } from '~/components/ui/common-empty-state';
import { Separator } from '~/components/ui/separator';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { getSelectedRecordingGroupId, setCurrentRecordingFolderName, setSelectedRecordingGroupId } from '~/data/mmkv/app-config';
import { isSystemGroupId, SYSTEM_GROUPS } from '~/data/sqlite/group-model';
import type { Folder } from '~/data/sqlite/services/folders.service';
import { listFolders } from '~/data/sqlite/services/folders.service';
import {
    hardDeleteRecordingMeta,
    listActiveRecordingMetaOverview,
    listDeletedRecordingMetaOverview,
    softDeleteRecordingMeta,
    updateRecordingDisplayName,
} from '~/data/sqlite/services/recordings.service';
import type { RecordingListItem } from '~/features/home/components/file-list-view';
import { FileListRow } from '~/features/home/components/file-list-view';
import GroupControlBar from '~/features/home/components/group-control-bar';
import HomeTopActions from '~/features/home/components/home-top-actions';
import NameInputDialog from '~/features/home/components/name-input-dialog';
import { useFileSelection } from '~/features/home/hooks/use-file-selection';
import { useItemActions } from '~/features/home/hooks/use-item-actions';
import { useSingleItemActions } from '~/features/home/hooks/use-single-item-actions';
import { useColor } from '~/hooks/use-color';

type HomeRecordingItem = {
    path: string;
    displayName: string | null;
    groupName: string | null;
    deletedAtMs: number | null;
    isFavorite: boolean;
    durationMs: number | null;
    recordedAtMs: number | null;
};

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

type HomeListProps = {
    bottomInset?: number;
};

export default function HomeList({ bottomInset = 0 }: HomeListProps) {
    const router = useRouter();
    const { toast } = useToast();
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
    const [loadError, setLoadError] = React.useState<string | null>(null);

    const textColor = useColor('text');
    const destructiveColor = useColor('red');
    const cardColor = useColor('card');

    const { shareSingleFile } = useItemActions({ toastApi: { toast } });
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
                setLoadError(null);
            } catch (error) {
                setItems([]);
                setFolders([]);
                setLoadError((error as Error)?.message ?? '列表加载失败，请稍后重试');
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
        setSelectedRecordingGroupId(selectedGroupId);
        const folderName = normalizeGroupNameForWrite(selectedGroupId);
        setCurrentRecordingFolderName(folderName);
    }, [selectedGroupId]);

    const groupTabs = React.useMemo(() => {
        const customGroups = folders.map(folder => folder.name.trim()).filter(name => name && !isSystemGroupId(name));

        return [SYSTEM_GROUPS.all, SYSTEM_GROUPS.meeting, ...customGroups, SYSTEM_GROUPS.recentlyDeleted];
    }, [folders]);

    const {
        selectedPaths,
        selectedPathSet,
        setSelectedPaths,
        toggleSelectPath,
        clearSelectedPaths,
        addSelectedPath,
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

    const handleOpenRenameForSelection = React.useCallback(() => {
        if (selectedCount !== 1) {
            toast({ title: '请选择 1 个文件后重命名', variant: 'info' });
            return;
        }
        const path = selectedPaths[0];
        const target = items.find(item => item.path === path);
        setRenameValue(target?.displayName?.trim() || extractFileName(path));
        setRenameError('');
        setRenameDialogVisible(true);
    }, [items, selectedCount, selectedPaths, toast]);

    const handleOpenDeleteForSelection = React.useCallback(() => {
        if (selectedCount === 0) {
            return;
        }
        setDeleteDialogVisible(true);
    }, [selectedCount]);

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

    const { openSingleActions } = useSingleItemActions({
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
        toastApi: { toast },
    });

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

    const handleOpenGroups = React.useCallback(() => {
        router.push('/recording-groups' as never);
    }, [router]);

    const handleOpenItem = React.useCallback(
        (entry: RecordingListItem) => {
            const initialName = entry.displayName ?? extractFileName(entry.path);
            router.push({
                pathname: '/import-audio',
                params: {
                    uri: entry.path,
                    name: initialName,
                    recordedAtMs: entry.recordedAtMs ? String(entry.recordedAtMs) : undefined,
                    source: 'list',
                },
            });
        },
        [router],
    );

    const handleSelectionAction = React.useCallback(
        (action: SelectionModeActionType) => {
            switch (action) {
                case 'cancel':
                    handleToggleMultiSelectMode();
                    return;
                case 'selectAll':
                    toggleSelectAllFiltered();
                    return;
                case 'rename':
                    handleOpenRenameForSelection();
                    return;
                case 'delete':
                    handleOpenDeleteForSelection();
                    return;
                default:
                    return;
            }
        },
        [handleOpenDeleteForSelection, handleOpenRenameForSelection, handleToggleMultiSelectMode, toggleSelectAllFiltered],
    );

    const topBarLeft = React.useMemo(
        () => (
            <>
                <TextX className="text-[24px] font-semibold">音频</TextX>
                <TextX variant="description" className="px-1 !text-base">
                    n个音频
                </TextX>
            </>
        ),
        [],
    );

    const renderListItem = React.useCallback(
        ({ item: row }: ListRenderItemInfo<HomeRecordingItem>) => {
            return (
                <>
                    <FileListRow
                        item={row}
                        isMultiSelectMode={isMultiSelectMode}
                        isSelected={selectedPathSet.has(row.path)}
                        extractFileName={extractFileName}
                        onToggleSelectPath={toggleSelectPath}
                        onEnterMultiSelectWithItem={enterMultiSelectWithItem}
                        onOpenSingleActionForItem={openSingleActions}
                        onOpenItem={handleOpenItem}
                    />
                    <Separator />
                </>
            );
        },
        [enterMultiSelectWithItem, handleOpenItem, isMultiSelectMode, openSingleActions, selectedPathSet, toggleSelectPath],
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
            <SelectionModeLayout
                left={<TextX className="!text-3xl !font-semibold">音频</TextX>}
                right={<HomeTopActions />}
                isSelectionMode={isMultiSelectMode}
                selectedCount={selectedCount}
                canSelectAll={items.length > 0}
                bottomActions={['rename', 'delete']}
                onAction={handleSelectionAction}
                topBarMinHeight={56}
            />
            <GroupControlBar
                groupTabs={groupTabs}
                selectedGroupId={selectedGroupId}
                onPressGroup={setSelectedGroupId}
                onOpenGroups={handleOpenGroups}
            />
            <View className="mt-2 flex-1 overflow-hidden rounded-t-2xl" style={{ backgroundColor: cardColor }}>
                <FlatList<HomeRecordingItem>
                    className="flex-1"
                    data={items}
                    keyExtractor={item => item.path}
                    ListEmptyComponent={
                        !loading ? (
                            <CommonEmptyState
                                text={loadError ?? (selectedGroupId === SYSTEM_GROUPS.recentlyDeleted ? '最近删除为空' : '暂无录音文件')}
                                Icon={CassetteTape}
                            />
                        ) : null
                    }
                    renderItem={renderListItem}
                    contentContainerStyle={{ paddingBottom: bottomInset + 500 + (isMultiSelectMode ? BOTTOM_TOOLBAR_HEIGHT : 0) }}
                    scrollEventThrottle={16}
                />
            </View>

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
