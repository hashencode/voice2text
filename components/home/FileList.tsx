import { useFocusEffect } from 'expo-router';
import { FolderInput, PencilLine, Share2, Trash2, Upload } from 'lucide-react-native';
import React from 'react';
import { Alert, Animated, Easing, Pressable, View } from 'react-native';
import FileListItem from '~/components/home/FileListItem';
import FileListToolbar from '~/components/home/FileListToolbar';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { Checkbox } from '~/components/ui/checkbox';
import { Input } from '~/components/ui/input';
import { PullToRefreshScrollView } from '~/components/ui/pull-to-refresh-scrollview';
import { Separator } from '~/components/ui/separator';
import { TextX } from '~/components/ui/textx';
import { listRecordingMeta, updateRecordingDisplayName } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { FONT_SIZE_SM } from '~/theme/globals';
import { formatDate, formatDuration } from '~/utils/format';

type HomeRecordingItem = {
    path: string;
    displayName: string | null;
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

export default function FileList() {
    const [items, setItems] = React.useState<HomeRecordingItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedFolder, setSelectedFolder] = React.useState<string>(ALL_FOLDERS_KEY);
    const [isMultiSelectMode, setIsMultiSelectMode] = React.useState(false);
    const [selectedPaths, setSelectedPaths] = React.useState<string[]>([]);
    const [renameDialogVisible, setRenameDialogVisible] = React.useState(false);
    const [renameValue, setRenameValue] = React.useState('');
    const [renaming, setRenaming] = React.useState(false);
    const textColor = useColor('text');
    const cardColor = useColor('card');
    const borderColor = useColor('border');

    const refreshList = React.useCallback(async (mode: 'focus' | 'pull' = 'focus') => {
        if (mode === 'focus') {
            setLoading(true);
        }
        try {
            const rows = await listRecordingMeta();
            setItems(
                rows.map(item => ({
                    path: item.path,
                    displayName: item.displayName ?? null,
                    durationMs: item.durationMs,
                    recordedAtMs: item.recordedAtMs,
                })),
            );
        } catch (error) {
            setItems([]);
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
    const folderOptions = React.useMemo(() => {
        const folderSet = new Set<string>();
        items.forEach(item => {
            folderSet.add(extractFolder(item.path));
        });
        return [
            { label: '全部文件夹', value: ALL_FOLDERS_KEY },
            ...Array.from(folderSet)
                .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
                .map(folder => ({ label: folder, value: folder })),
        ];
    }, [items]);

    const filteredItems = React.useMemo(() => {
        if (selectedFolder === ALL_FOLDERS_KEY) {
            return items;
        }
        return items.filter(item => extractFolder(item.path) === selectedFolder);
    }, [items, selectedFolder]);
    const selectedCount = selectedPaths.length;
    const actionMenuVisible = isMultiSelectMode && selectedCount > 0;
    const actionMenuOpacity = React.useRef(new Animated.Value(0)).current;
    const actionMenuTranslateY = React.useRef(new Animated.Value(16)).current;
    const selectedPathForRename = selectedCount === 1 ? selectedPaths[0] : null;
    const selectedItemForRename = React.useMemo(
        () => (selectedPathForRename ? items.find(item => item.path === selectedPathForRename) : undefined),
        [items, selectedPathForRename],
    );

    const toggleSelectPath = React.useCallback((path: string) => {
        setSelectedPaths(prev => (prev.includes(path) ? prev.filter(item => item !== path) : [...prev, path]));
    }, []);

    const handleToggleMultiSelectMode = React.useCallback(() => {
        setIsMultiSelectMode(prev => {
            if (prev) {
                setSelectedPaths([]);
            }
            return !prev;
        });
    }, []);

    const enterMultiSelectWithItem = React.useCallback((path: string) => {
        setIsMultiSelectMode(true);
        setSelectedPaths(prev => (prev.includes(path) ? prev : [...prev, path]));
    }, []);

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(actionMenuOpacity, {
                toValue: actionMenuVisible ? 1 : 0,
                duration: 220,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(actionMenuTranslateY, {
                toValue: actionMenuVisible ? 0 : 16,
                duration: 220,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start();
    }, [actionMenuOpacity, actionMenuTranslateY, actionMenuVisible]);

    const actionMenuTitle = selectedCount <= 0 ? '请选择文件' : `已选择 ${selectedCount} 个文件`;
    const handleOpenRenameDialog = React.useCallback(() => {
        if (!selectedItemForRename) {
            return;
        }
        setRenameValue(selectedItemForRename.displayName?.trim() || extractFileName(selectedItemForRename.path));
        setRenameDialogVisible(true);
    }, [selectedItemForRename]);
    const handleConfirmRename = React.useCallback(async () => {
        if (!selectedPathForRename || renaming) {
            return;
        }
        const trimmedName = renameValue.trim();
        if (!trimmedName) {
            Alert.alert('重命名失败', '名称不能为空');
            return;
        }
        try {
            setRenaming(true);
            await updateRecordingDisplayName(selectedPathForRename, trimmedName);
            setItems(prev => prev.map(item => (item.path === selectedPathForRename ? { ...item, displayName: trimmedName } : item)));
            setRenameDialogVisible(false);
        } catch {
            Alert.alert('重命名失败', '保存名称时发生错误，请稍后重试');
        } finally {
            setRenaming(false);
        }
    }, [renameValue, renaming, selectedPathForRename]);
    const handleActionPress = React.useCallback(
        (actionKey: string) => {
            if (actionKey === 'rename') {
                handleOpenRenameDialog();
                return;
            }
        },
        [handleOpenRenameDialog],
    );
    const actionMenuActions = [
        { key: 'rename', label: '重命名', icon: PencilLine, disabled: selectedCount !== 1 },
        { key: 'move', label: '移动到', icon: FolderInput, disabled: false },
        { key: 'delete', label: '删除', icon: Trash2, disabled: false },
        { key: 'share', label: '分享', icon: Share2, disabled: false },
        { key: 'export', label: '导出', icon: Upload, disabled: false },
    ];

    return (
        <View className="flex-1">
            <FileListToolbar
                isMultiSelectMode={isMultiSelectMode}
                actionMenuTitle={actionMenuTitle}
                folderOptions={folderOptions}
                selectedFolder={selectedFolder}
                isResetFolderDisabled={selectedFolder === ALL_FOLDERS_KEY}
                onSelectFolder={setSelectedFolder}
                onResetFolder={() => {
                    if (selectedFolder !== ALL_FOLDERS_KEY) {
                        setSelectedFolder(ALL_FOLDERS_KEY);
                    }
                }}
                onToggleMultiSelectMode={handleToggleMultiSelectMode}
            />
            <PullToRefreshScrollView
                onRefresh={onPullRefresh}
                isEmpty={!loading && filteredItems.length === 0}
                emptyText="暂无录音文件"
                isLoadedAll={!loading && filteredItems.length > 0}
                loadedAllText="已加载全部录音"
                contentContainerStyle={{ paddingBottom: actionMenuVisible ? 96 : 12 }}>
                {filteredItems?.map((item, index) => (
                    <React.Fragment key={item.path}>
                        <FileListItem
                            name={item.displayName?.trim() || extractFileName(item.path)}
                            durationText={formatDuration(item.durationMs)}
                            createdAtText={formatDate(item.recordedAtMs)}
                            showArrow={!isMultiSelectMode}
                            onPress={() => {
                                if (isMultiSelectMode) {
                                    toggleSelectPath(item.path);
                                }
                            }}
                            onLongPress={isMultiSelectMode ? () => toggleSelectPath(item.path) : () => enterMultiSelectWithItem(item.path)}
                            rightSlot={
                                isMultiSelectMode ? (
                                    <Checkbox
                                        checked={selectedPaths.includes(item.path)}
                                        onCheckedChange={() => toggleSelectPath(item.path)}
                                    />
                                ) : undefined
                            }
                        />
                        {index < filteredItems.length - 1 ? <Separator /> : null}
                    </React.Fragment>
                ))}
            </PullToRefreshScrollView>
            <Animated.View
                pointerEvents={actionMenuVisible ? 'auto' : 'none'}
                style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,

                    backgroundColor: cardColor,
                    opacity: actionMenuOpacity,
                    transform: [{ translateY: actionMenuTranslateY }],
                }}>
                <View className="border-t py-4" style={{ borderTopColor: borderColor }}>
                    <View className="flex flex-row justify-between">
                        {actionMenuActions.map(action => (
                            <Pressable
                                key={action.key}
                                onPress={() => handleActionPress(action.key)}
                                disabled={action.disabled}
                                className="w-1/5 items-center justify-center gap-y-1 rounded-xl"
                                style={{
                                    opacity: action.disabled ? 0.45 : 1,
                                }}>
                                <action.icon size={26} color={textColor} strokeWidth={1.5} />
                                <TextX style={{ fontSize: FONT_SIZE_SM }}>{action.label}</TextX>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </Animated.View>
            <AlertDialog
                isVisible={renameDialogVisible}
                onClose={() => {
                    setRenameDialogVisible(false);
                }}
                title="重命名文件"
                description="只修改显示名称，不会修改原始文件名。"
                confirmText={renaming ? '保存中...' : '确定'}
                cancelText="取消"
                confirmButtonProps={{ disabled: renaming }}
                cancelButtonProps={{ disabled: renaming }}
                onConfirm={() => {
                    handleConfirmRename().catch(() => {});
                }}>
                <Input
                    value={renameValue}
                    onChangeText={setRenameValue}
                    placeholder="输入新的文件名"
                    autoFocus
                    returnKeyType="done"
                    clearable
                    onSubmitEditing={() => {
                        handleConfirmRename().catch(() => {});
                    }}
                />
            </AlertDialog>
        </View>
    );
}
