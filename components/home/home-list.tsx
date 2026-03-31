import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { FolderInput, Heart, HeartOff, PencilLine, Share2, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NameInputDialog from '~/components/home/common/name-input-dialog';
import FileListToolbar from '~/components/home/file-list/file-list-toolbar';
import FileListView from '~/components/home/file-list/file-list-view';
import FolderListToolbar from '~/components/home/folder-list/folder-list-toolbar';
import FolderListView from '~/components/home/folder-list/folder-list-view';
import { useFileActions } from '~/components/home/hooks/use-file-actions';
import { useFileSelection } from '~/components/home/hooks/use-file-selection';
import { useFolderActions } from '~/components/home/hooks/use-folder-actions';
import { useFolderSelection } from '~/components/home/hooks/use-folder-selection';
import { useItemActions } from '~/components/home/hooks/use-item-actions';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { ModalMask } from '~/components/ui/modal-mask';
import { PullToRefreshScrollView } from '~/components/ui/pull-to-refresh-scrollview';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { setCurrentRecordingFolderName } from '~/db/mmkv/app-config';
import type { Folder } from '~/db/sqlite/services/folders.service';
import { listFolders, updateFolderFavorite } from '~/db/sqlite/services/folders.service';
import { listRecordingMeta, updateRecordingFavorite } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { FONT_SIZE_SM } from '~/theme/globals';

type HomeRecordingItem = {
    path: string;
    displayName: string | null;
    isFavorite: boolean;
    durationMs: number | null;
    recordedAtMs: number | null;
};

const ALL_FOLDERS_KEY = '__all_folders__';

function extractFileName(path: string): string {
    const name = path.split('/').pop() ?? path;
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex <= 0) {
        return name;
    }
    return name.slice(0, dotIndex);
}

function extractFolder(path: string): string {
    const normalizedPath = path.replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
        return '根目录';
    }
    return parts[parts.length - 2] ?? '根目录';
}

export default function HomeList() {
    const { toast } = useToast();
    const insets = useSafeAreaInsets();
    const [items, setItems] = React.useState<HomeRecordingItem[]>([]);
    const [folders, setFolders] = React.useState<Folder[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedFolder, setSelectedFolder] = React.useState<string>(ALL_FOLDERS_KEY);
    const [isFolderListMode, setIsFolderListMode] = React.useState(false);
    const [isMultiSelectMode, setIsMultiSelectMode] = React.useState(false);
    const [isSingleSelectMode, setIsSingleSelectMode] = React.useState(false);
    const [isSingleSelectClosing, setIsSingleSelectClosing] = React.useState(false);
    const [renameDialogVisible, setRenameDialogVisible] = React.useState(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = React.useState(false);
    const [createFolderDialogVisible, setCreateFolderDialogVisible] = React.useState(false);
    const [renameValue, setRenameValue] = React.useState('');
    const [renameError, setRenameError] = React.useState('');
    const [createFolderValue, setCreateFolderValue] = React.useState('');
    const [createFolderError, setCreateFolderError] = React.useState('');
    const [renaming, setRenaming] = React.useState(false);
    const [creatingFolder, setCreatingFolder] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const textColor = useColor('text');
    const cardColor = useColor('card');
    const borderColor = useColor('border');
    const { sharing, shareSingleFile } = useItemActions({ toastApi: { toast } });

    const refreshList = React.useCallback(async (mode: 'focus' | 'pull' = 'focus') => {
        if (mode === 'focus') {
            setLoading(true);
        }
        try {
            const [rows, folderRows] = await Promise.all([listRecordingMeta(), listFolders()]);
            setItems(
                rows.map(item => ({
                    path: item.path,
                    displayName: item.displayName ?? null,
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
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            refreshList('focus').catch(() => {
                setItems([]);
                setLoading(false);
            });
        }, [refreshList]),
    );

    const onPullRefresh = React.useCallback(() => refreshList('pull'), [refreshList]);
    const folderListEntries = React.useMemo(
        () => [
            { name: ALL_FOLDERS_KEY, createdAtMs: 0 as number, isFavorite: false },
            ...folders.filter(folder => folder.name !== ALL_FOLDERS_KEY),
        ],
        [folders],
    );
    const currentFolderLabel = isFolderListMode ? '文件夹列表' : selectedFolder === ALL_FOLDERS_KEY ? '全部文件' : selectedFolder;

    const filteredItems = React.useMemo(() => {
        if (selectedFolder === ALL_FOLDERS_KEY) {
            return items;
        }
        return items.filter(item => extractFolder(item.path) === selectedFolder);
    }, [items, selectedFolder]);
    const fileCountByFolderName = React.useMemo(() => {
        const countMap: Record<string, number> = {
            [ALL_FOLDERS_KEY]: items.length,
        };
        items.forEach(item => {
            const folderName = extractFolder(item.path);
            countMap[folderName] = (countMap[folderName] ?? 0) + 1;
        });
        return countMap;
    }, [items]);
    const selectableFolderNames = React.useMemo(
        () => folderListEntries.filter(folder => folder.name !== ALL_FOLDERS_KEY).map(folder => folder.name),
        [folderListEntries],
    );
    const {
        selectedPaths,
        setSelectedPaths,
        toggleSelectPath,
        clearSelectedPaths,
        addSelectedPath,
        isAllFilteredSelected: isAllFilesSelected,
        toggleSelectAllFiltered,
    } = useFileSelection(filteredItems.map(item => item.path));
    const {
        selectedFolderNames,
        setSelectedFolderNames,
        toggleSelectFolderName,
        clearSelectedFolderNames,
        addSelectedFolderName,
        isAllFoldersSelected,
        toggleSelectAllFolders,
    } = useFolderSelection(selectableFolderNames, ALL_FOLDERS_KEY);
    const selectedCount = isFolderListMode ? selectedFolderNames.length : selectedPaths.length;
    const isSingleMaskVisible = isSingleSelectMode;
    const shouldRenderActionMenu = (isMultiSelectMode && selectedCount > 0) || isSingleSelectMode || isSingleSelectClosing;
    const selectedPathForRename = selectedCount === 1 ? selectedPaths[0] : null;
    const selectedItemForRename = React.useMemo(
        () => (selectedPathForRename ? items.find(item => item.path === selectedPathForRename) : undefined),
        [items, selectedPathForRename],
    );
    const selectedFolderNameForRename = selectedCount === 1 ? selectedFolderNames[0] : null;
    const isAllFilteredSelected = isFolderListMode ? isAllFoldersSelected : isAllFilesSelected;
    const isSingleTargetFavorited = React.useMemo(() => {
        if (!isSingleSelectMode || selectedCount !== 1) {
            return false;
        }
        if (isFolderListMode) {
            if (!selectedFolderNameForRename) {
                return false;
            }
            return folders.some(folder => folder.name === selectedFolderNameForRename && folder.isFavorite);
        }
        return selectedItemForRename?.isFavorite === true;
    }, [folders, isFolderListMode, isSingleSelectMode, selectedCount, selectedFolderNameForRename, selectedItemForRename]);

    const handleToggleMultiSelectMode = React.useCallback(() => {
        setIsMultiSelectMode(prev => {
            if (prev) {
                clearSelectedPaths();
                clearSelectedFolderNames();
                setIsSingleSelectMode(false);
                setIsSingleSelectClosing(false);
            } else {
                // Entering multi-select should start clean and not inherit single-action selection.
                clearSelectedPaths();
                clearSelectedFolderNames();
                setIsSingleSelectMode(false);
                setIsSingleSelectClosing(false);
            }
            return !prev;
        });
    }, [clearSelectedFolderNames, clearSelectedPaths]);

    const handleToggleSelectAll = React.useCallback(() => {
        if (isFolderListMode) {
            toggleSelectAllFolders();
            return;
        }
        toggleSelectAllFiltered();
    }, [isFolderListMode, toggleSelectAllFiltered, toggleSelectAllFolders]);

    const enterMultiSelectWithItem = React.useCallback(
        (path: string) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setIsSingleSelectMode(false);
            setIsSingleSelectClosing(false);
            setIsMultiSelectMode(true);
            addSelectedPath(path);
        },
        [addSelectedPath],
    );

    const enterMultiSelectWithFolder = React.useCallback(
        (name: string) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setIsSingleSelectMode(false);
            setIsSingleSelectClosing(false);
            setIsMultiSelectMode(true);
            if (name !== ALL_FOLDERS_KEY) {
                addSelectedFolderName(name);
            }
        },
        [addSelectedFolderName],
    );
    React.useEffect(() => {
        const recordingFolderName = !isFolderListMode && selectedFolder !== ALL_FOLDERS_KEY ? selectedFolder : null;
        setCurrentRecordingFolderName(recordingFolderName);
    }, [isFolderListMode, selectedFolder]);
    const closeSingleSelectMode = React.useCallback(() => {
        if (!isSingleSelectMode) {
            return;
        }
        setIsSingleSelectClosing(true);
        setIsSingleSelectMode(false);
    }, [isSingleSelectMode]);
    const handleSingleSelectClosed = React.useCallback(() => {
        setSelectedPaths([]);
        setSelectedFolderNames([]);
        setIsSingleSelectClosing(false);
    }, [setSelectedFolderNames, setSelectedPaths]);
    const openSingleActionForFile = React.useCallback(
        (path: string) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setIsMultiSelectMode(false);
            setIsSingleSelectClosing(false);
            setIsSingleSelectMode(true);
            setSelectedFolderNames([]);
            setSelectedPaths([path]);
        },
        [setSelectedFolderNames, setSelectedPaths],
    );
    const openSingleActionForFolder = React.useCallback(
        (name: string) => {
            if (name === ALL_FOLDERS_KEY) {
                return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setIsMultiSelectMode(false);
            setIsSingleSelectClosing(false);
            setIsSingleSelectMode(true);
            setSelectedPaths([]);
            setSelectedFolderNames([name]);
        },
        [setSelectedFolderNames, setSelectedPaths],
    );

    const actionMenuTitle =
        selectedCount <= 0
            ? isFolderListMode
                ? '请选择文件夹'
                : '请选择文件'
            : `已选择 ${selectedCount} 个${isFolderListMode ? '文件夹' : '文件'}`;

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
    const { confirmRenameFile, confirmDeleteFiles } = useFileActions({
        items,
        selectedPaths,
        selectedPathForRename,
        renameValue,
        validateName: validateRenameName,
        extractFileName,
        toastApi: { toast },
        setItems,
        setSelectedPaths,
    });
    const { confirmRenameFolder, confirmCreateFolder, confirmDeleteFolders } = useFolderActions({
        allFoldersKey: ALL_FOLDERS_KEY,
        folders,
        selectedFolder,
        selectedFolderNames,
        renameValue,
        createFolderValue,
        validateName: validateRenameName,
        toastApi: { toast },
        setFolders,
        setSelectedFolder,
        setSelectedFolderNames,
    });

    const handleOpenRenameDialog = React.useCallback(() => {
        if (isFolderListMode) {
            if (!selectedFolderNameForRename) {
                return;
            }
            setRenameValue(selectedFolderNameForRename);
            setRenameError('');
            setRenameDialogVisible(true);
            return;
        }
        if (!selectedItemForRename) {
            return;
        }
        setRenameValue(selectedItemForRename.displayName?.trim() || extractFileName(selectedItemForRename.path));
        setRenameError('');
        setRenameDialogVisible(true);
    }, [isFolderListMode, selectedFolderNameForRename, selectedItemForRename]);

    const handleOpenCreateFolderDialog = React.useCallback(() => {
        setCreateFolderValue('');
        setCreateFolderError('');
        setCreateFolderDialogVisible(true);
    }, []);
    const handleConfirmRename = React.useCallback(async (): Promise<boolean> => {
        if (isFolderListMode) {
            return confirmRenameFolder({
                renaming,
                selectedFolderNameForRename,
                setRenaming,
                setRenameError,
                closeRenameDialog: () => setRenameDialogVisible(false),
            });
        }
        return confirmRenameFile({
            renaming,
            setRenaming,
            setRenameError,
            setRenameValue,
            closeRenameDialog: () => setRenameDialogVisible(false),
        });
    }, [confirmRenameFile, confirmRenameFolder, isFolderListMode, renaming, selectedFolderNameForRename]);
    const handleConfirmCreateFolder = React.useCallback(
        () =>
            confirmCreateFolder({
                creatingFolder,
                setCreatingFolder,
                setCreateFolderError,
                closeCreateDialog: () => setCreateFolderDialogVisible(false),
            }),
        [confirmCreateFolder, creatingFolder],
    );
    const handleConfirmDelete = React.useCallback(async (): Promise<boolean> => {
        if (isFolderListMode) {
            return confirmDeleteFolders({
                deleting,
                setDeleting,
                closeDeleteDialog: () => setDeleteDialogVisible(false),
            });
        }
        return confirmDeleteFiles({
            deleting,
            setDeleting,
            closeDeleteDialog: () => setDeleteDialogVisible(false),
        });
    }, [confirmDeleteFiles, confirmDeleteFolders, deleting, isFolderListMode]);

    const handleUpdateFavorite = React.useCallback(
        async (isFavorite: boolean): Promise<void> => {
            if (selectedCount <= 0) {
                return;
            }

            if (isFolderListMode) {
                const targetNames = selectedFolderNames.filter(name => name !== ALL_FOLDERS_KEY);
                if (targetNames.length <= 0) {
                    return;
                }
                await Promise.all(targetNames.map(name => updateFolderFavorite(name, isFavorite)));
                const targetSet = new Set(targetNames);
                setFolders(prev => prev.map(folder => (targetSet.has(folder.name) ? { ...folder, isFavorite } : folder)));
                toast({
                    title: isFavorite ? '已收藏文件夹' : '已取消收藏文件夹',
                    variant: 'success',
                });
                return;
            }

            await Promise.all(selectedPaths.map(path => updateRecordingFavorite(path, isFavorite)));
            const targetSet = new Set(selectedPaths);
            setItems(prev => prev.map(item => (targetSet.has(item.path) ? { ...item, isFavorite } : item)));
            toast({
                title: isFavorite ? '已收藏文件' : '已取消收藏文件',
                variant: 'success',
            });
        },
        [isFolderListMode, selectedCount, selectedFolderNames, selectedPaths, toast],
    );

    const handleActionPress = React.useCallback(
        (actionKey: string) => {
            if (actionKey === 'rename') {
                closeSingleSelectMode();
                handleOpenRenameDialog();
                return;
            }
            if (actionKey === 'delete') {
                if (selectedCount <= 0) {
                    return;
                }
                closeSingleSelectMode();
                setDeleteDialogVisible(true);
                return;
            }
            if (actionKey === 'share') {
                closeSingleSelectMode();
                shareSingleFile(selectedPaths).catch(() => {});
                return;
            }
            if (actionKey === 'favorite') {
                const shouldFavorite = !(isSingleSelectMode && isSingleTargetFavorited);
                handleUpdateFavorite(shouldFavorite).catch(() => {
                    toast({
                        title: shouldFavorite ? '收藏失败' : '取消收藏失败',
                        description: '请稍后重试',
                        variant: 'error',
                    });
                });
                closeSingleSelectMode();
                return;
            }
        },
        [
            closeSingleSelectMode,
            handleOpenRenameDialog,
            handleUpdateFavorite,
            isSingleSelectMode,
            isSingleTargetFavorited,
            selectedCount,
            selectedPaths,
            shareSingleFile,
            toast,
        ],
    );
    const favoriteAction =
        isSingleSelectMode && isSingleTargetFavorited
            ? { key: 'favorite', label: '取消收藏', icon: HeartOff, disabled: selectedCount === 0 }
            : { key: 'favorite', label: '收藏', icon: Heart, disabled: selectedCount === 0 };
    const actionMenuActions = isFolderListMode
        ? isMultiSelectMode
            ? [{ key: 'delete', label: '删除', icon: Trash2, disabled: selectedCount === 0 }]
            : [
                  { key: 'rename', label: '重命名', icon: PencilLine, disabled: selectedCount === 0 },
                  favoriteAction,
                  { key: 'delete', label: '删除', icon: Trash2, disabled: selectedCount === 0 },
              ]
        : isMultiSelectMode
          ? [
                { key: 'move', label: '移动到', icon: FolderInput, disabled: selectedCount === 0 },
                { key: 'share', label: '分享', icon: Share2, disabled: selectedCount === 0 || sharing },
                { key: 'delete', label: '删除', icon: Trash2, disabled: selectedCount === 0 },
            ]
          : [
                { key: 'rename', label: '重命名', icon: PencilLine, disabled: selectedCount === 0 },
                { key: 'move', label: '移动到', icon: FolderInput, disabled: selectedCount === 0 },
                favoriteAction,
                { key: 'share', label: '分享', icon: Share2, disabled: selectedCount === 0 || sharing },
                { key: 'delete', label: '删除', icon: Trash2, disabled: selectedCount === 0 },
            ];
    const actionMenuContent = (
        <View className="border-t pt-4" style={{ borderTopColor: borderColor, paddingBottom: 16 }}>
            <View className="flex flex-row justify-between">
                {actionMenuActions.map(action => (
                    <Pressable
                        key={action.key}
                        onPress={() => handleActionPress(action.key)}
                        disabled={action.disabled}
                        className="flex-1 items-center justify-center gap-y-1 rounded-xl"
                        style={{
                            opacity: action.disabled ? 0.45 : 1,
                        }}>
                        <action.icon size={26} color={textColor} strokeWidth={1.5} />
                        <TextX style={{ fontSize: FONT_SIZE_SM }}>{action.label}</TextX>
                    </Pressable>
                ))}
            </View>
            <BottomSafeAreaSpacer />
        </View>
    );
    const actionMenuLayer = (
        <View
            pointerEvents={shouldRenderActionMenu ? 'auto' : 'none'}
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: cardColor,
            }}>
            {actionMenuContent}
        </View>
    );

    return (
        <View className="flex-1">
            {isFolderListMode ? (
                <FolderListToolbar
                    isMultiSelectMode={isMultiSelectMode}
                    actionMenuTitle={actionMenuTitle}
                    currentFolderLabel={currentFolderLabel}
                    onCreateFolder={handleOpenCreateFolderDialog}
                    isAllSelected={isAllFilteredSelected}
                    isToggleSelectAllDisabled={!isMultiSelectMode || selectableFolderNames.length === 0}
                    onToggleSelectAll={handleToggleSelectAll}
                    onToggleMultiSelectMode={handleToggleMultiSelectMode}
                />
            ) : (
                <FileListToolbar
                    isMultiSelectMode={isMultiSelectMode}
                    actionMenuTitle={actionMenuTitle}
                    currentFolderLabel={currentFolderLabel}
                    onPressFolderTitle={() => {
                        setIsFolderListMode(true);
                        if (isMultiSelectMode || isSingleSelectMode) {
                            setIsMultiSelectMode(false);
                            setIsSingleSelectMode(false);
                            setIsSingleSelectClosing(false);
                            setSelectedPaths([]);
                            setSelectedFolderNames([]);
                        }
                    }}
                    onPressSearch={() => {
                        toast({
                            title: '搜索功能即将上线',
                            variant: 'info',
                        });
                    }}
                    isAllSelected={isAllFilteredSelected}
                    isToggleSelectAllDisabled={!isMultiSelectMode || filteredItems.length === 0}
                    onToggleSelectAll={handleToggleSelectAll}
                    onToggleMultiSelectMode={handleToggleMultiSelectMode}
                />
            )}
            <PullToRefreshScrollView
                onRefresh={onPullRefresh}
                isEmpty={!loading && (isFolderListMode ? folderListEntries.length === 0 : filteredItems.length === 0)}
                emptyText={isFolderListMode ? '暂无文件夹' : '暂无录音文件'}
                isLoadedAll={!loading && !isFolderListMode && filteredItems.length > 0}
                loadedAllText={isFolderListMode ? '已加载全部文件夹' : '已加载全部录音'}
                contentContainerStyle={{ paddingBottom: shouldRenderActionMenu ? 96 + insets.bottom : 12 }}>
                {isFolderListMode ? (
                    <FolderListView
                        folders={folderListEntries}
                        selectedFolder={selectedFolder}
                        selectedFolderNames={selectedFolderNames}
                        allFoldersKey={ALL_FOLDERS_KEY}
                        isMultiSelectMode={isMultiSelectMode}
                        fileCountByFolderName={fileCountByFolderName}
                        onSelectFolder={name => {
                            setSelectedFolder(name);
                            setIsFolderListMode(false);
                            setIsSingleSelectMode(false);
                            setSelectedFolderNames([]);
                        }}
                        onToggleSelectFolderName={toggleSelectFolderName}
                        onEnterMultiSelectWithFolder={enterMultiSelectWithFolder}
                        onOpenSingleActionForFolder={openSingleActionForFolder}
                    />
                ) : (
                    <FileListView
                        items={filteredItems}
                        isMultiSelectMode={isMultiSelectMode}
                        selectedPaths={selectedPaths}
                        extractFileName={extractFileName}
                        onToggleSelectPath={toggleSelectPath}
                        onEnterMultiSelectWithItem={enterMultiSelectWithItem}
                        onOpenSingleActionForItem={openSingleActionForFile}
                    />
                )}
            </PullToRefreshScrollView>
            <ModalMask
                isVisible={isSingleMaskVisible}
                onPressMask={closeSingleSelectMode}
                onClose={handleSingleSelectClosed}
                contentTransitionPreset="slide-up"
                mode="light">
                {actionMenuLayer}
            </ModalMask>
            {!isSingleMaskVisible && !isSingleSelectClosing && isMultiSelectMode && selectedCount > 0 ? actionMenuLayer : null}
            <NameInputDialog
                isVisible={renameDialogVisible}
                onClose={() => {
                    setRenameError('');
                    setRenameDialogVisible(false);
                }}
                title={isFolderListMode ? '重命名文件夹' : '重命名文件'}
                description={isFolderListMode ? '仅修改文件夹名称。' : '只修改显示名称，不会修改原始文件名。'}
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
                }}
                title="确认删除"
                confirmText="确认删除"
                cancelText="取消"
                confirmButtonProps={{ variant: 'destructive', disabled: deleting }}
                cancelButtonProps={{ disabled: deleting }}
                onConfirm={() => {
                    return handleConfirmDelete();
                }}>
                <TextX>
                    {isFolderListMode
                        ? `是否删除已选中的 ${selectedCount} 个文件夹，删除后无法恢复。`
                        : `是否删除已选中的 ${selectedCount} 个文件，删除后无法恢复。`}
                </TextX>
            </AlertDialog>
            <NameInputDialog
                isVisible={createFolderDialogVisible}
                onClose={() => {
                    if (creatingFolder) {
                        return;
                    }
                    setCreateFolderError('');
                    setCreateFolderDialogVisible(false);
                }}
                title="创建文件夹"
                description="创建后可在文件夹列表中查看。"
                value={createFolderValue}
                error={createFolderError}
                placeholder="输入文件夹名称"
                isSubmitting={creatingFolder}
                onChangeText={text => {
                    setCreateFolderValue(text);
                    if (createFolderError) {
                        const validationError = validateRenameName(text.trim());
                        setCreateFolderError(validationError ?? '');
                    }
                }}
                onConfirm={handleConfirmCreateFolder}
            />
        </View>
    );
}
