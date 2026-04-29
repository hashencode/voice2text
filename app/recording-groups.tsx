import { useFocusEffect, useRouter } from 'expo-router';
import { CassetteTape, LucideProps, Mic, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import SelectionModeLayout from '~/components/layout/selection-mode-layout';
import { useActionSheet } from '~/components/ui/action-sheet';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { List, ListItem } from '~/components/ui/list';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { getSelectedRecordingGroupId, setCurrentRecordingFolderName, setSelectedRecordingGroupId } from '~/data/mmkv/app-config';
import { getGroupLabel, isReservedGroupName, SYSTEM_GROUPS } from '~/data/sqlite/group-model';
import { createFolder, deleteFolder, listFolders, updateFolderName } from '~/data/sqlite/services/folders.service';
import { listActiveRecordingMetaOverview, listDeletedRecordingMetaOverview } from '~/data/sqlite/services/recordings.service';
import NameInputDialog from '~/features/home/components/name-input-dialog';
import { useColor } from '~/hooks/use-color';

type GroupItem = {
    id: string;
    isSystem: boolean;
    isMock?: boolean;
};

const MOCK_GROUPS_ENABLED = true;
const MOCK_GROUP_NAMES = Array.from({ length: 16 }, (_, index) => `示例分组 ${index + 1}`);

export default function RecordingGroupsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [groups, setGroups] = React.useState<GroupItem[]>([]);
    const [, setLoading] = React.useState(true);
    const [creatingVisible, setCreatingVisible] = React.useState(false);
    const [renamingVisible, setRenamingVisible] = React.useState(false);
    const [deleteVisible, setDeleteVisible] = React.useState(false);
    const [inputValue, setInputValue] = React.useState('');
    const [inputError, setInputError] = React.useState('');
    const [pendingGroupId, setPendingGroupId] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [selectedGroupId, setSelectedGroupIdState] = React.useState(() => getSelectedRecordingGroupId());
    const [groupCounts, setGroupCounts] = React.useState<Record<string, number>>({});
    const { show: showActionSheet, ActionSheet } = useActionSheet();
    const cardColor = useColor('card');
    const secondaryColor = useColor('secondary');
    const iconColor = useColor('text');
    const dividerColor = useColor('muted');
    const primaryColor = useColor('primary');

    const loadGroups = React.useCallback(async () => {
        setLoading(true);
        try {
            const [folderRows, activeRows, deletedRows] = await Promise.all([
                listFolders(),
                listActiveRecordingMetaOverview(),
                listDeletedRecordingMetaOverview(),
            ]);
            const customGroups = folderRows
                .map(row => row.name.trim())
                .filter(name => name && !isReservedGroupName(name))
                .map(name => ({ id: name, isSystem: false as const }));

            const systemGroups: GroupItem[] = [
                { id: SYSTEM_GROUPS.meeting, isSystem: true },
                { id: SYSTEM_GROUPS.recentlyDeleted, isSystem: true },
            ];

            const mockGroups: GroupItem[] = MOCK_GROUPS_ENABLED
                ? MOCK_GROUP_NAMES.map(name => ({ id: name, isSystem: false, isMock: true }))
                : [];
            setGroups([...systemGroups, ...customGroups, ...mockGroups]);
            const counts: Record<string, number> = {
                [SYSTEM_GROUPS.all]: activeRows.length,
                [SYSTEM_GROUPS.recentlyDeleted]: deletedRows.length,
            };
            for (const row of activeRows) {
                const key = row.groupName?.trim();
                if (!key) {
                    continue;
                }
                counts[key] = (counts[key] ?? 0) + 1;
            }
            if (MOCK_GROUPS_ENABLED) {
                MOCK_GROUP_NAMES.forEach((name, index) => {
                    counts[name] = (index + 1) * 3;
                });
            }
            setGroupCounts(counts);
            setSelectedGroupIdState(getSelectedRecordingGroupId());
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            loadGroups().catch(() => {
                setGroups([]);
                setLoading(false);
            });
        }, [loadGroups]),
    );

    const validateGroupName = React.useCallback(
        (value: string, currentName?: string | null): string | null => {
            const normalized = value.trim();
            if (!normalized) {
                return '名称不能为空';
            }
            if (normalized.length > 64) {
                return '名称过长，请控制在 64 个字符以内';
            }
            if (/[/\\:*?"<>|\u0000-\u001F]/.test(normalized)) {
                return '名称包含非法字符（\\ / : * ? " < > |）';
            }
            if (isReservedGroupName(normalized)) {
                return '该名称为系统保留分组';
            }
            if (groups.some(group => !group.isSystem && group.id !== currentName && group.id.toLowerCase() === normalized.toLowerCase())) {
                return '分组名称已存在';
            }
            return null;
        },
        [groups],
    );

    const setSelectedGroup = React.useCallback(
        (groupId: string) => {
            setSelectedRecordingGroupId(groupId);
            setCurrentRecordingFolderName(groupId === SYSTEM_GROUPS.all || groupId === SYSTEM_GROUPS.recentlyDeleted ? null : groupId);
            router.back();
        },
        [router],
    );

    const handleCreate = React.useCallback(async () => {
        if (submitting) {
            return false;
        }
        const error = validateGroupName(inputValue);
        if (error) {
            setInputError(error);
            return false;
        }

        setSubmitting(true);
        try {
            const name = inputValue.trim();
            await createFolder(name);
            toast({ title: '分组创建成功', variant: 'success' });
            setCreatingVisible(false);
            setInputValue('');
            setInputError('');
            await loadGroups();
            return true;
        } catch {
            setInputError('创建分组失败，请重试');
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [inputValue, loadGroups, submitting, toast, validateGroupName]);

    const handleRename = React.useCallback(async () => {
        if (submitting || !pendingGroupId) {
            return false;
        }
        const error = validateGroupName(inputValue, pendingGroupId);
        if (error) {
            setInputError(error);
            return false;
        }

        setSubmitting(true);
        try {
            const name = inputValue.trim();
            await updateFolderName(pendingGroupId, name);
            if (selectedGroupId === pendingGroupId) {
                setSelectedRecordingGroupId(name);
            }
            toast({ title: '重命名成功', variant: 'success' });
            setRenamingVisible(false);
            setPendingGroupId(null);
            setInputValue('');
            setInputError('');
            await loadGroups();
            return true;
        } catch {
            setInputError('重命名失败，请重试');
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [inputValue, loadGroups, pendingGroupId, selectedGroupId, submitting, toast, validateGroupName]);

    const handleDelete = React.useCallback(async () => {
        if (submitting || !pendingGroupId) {
            return false;
        }

        setSubmitting(true);
        try {
            await deleteFolder(pendingGroupId);
            if (selectedGroupId === pendingGroupId) {
                setSelectedRecordingGroupId(SYSTEM_GROUPS.all);
                setCurrentRecordingFolderName(null);
            }
            toast({ title: '分组已删除', variant: 'success' });
            setDeleteVisible(false);
            setPendingGroupId(null);
            await loadGroups();
            return true;
        } catch {
            toast({ title: '删除失败，请重试', variant: 'error' });
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [loadGroups, pendingGroupId, selectedGroupId, submitting, toast]);

    const openGroupActions = React.useCallback(
        (group: GroupItem) => {
            if (group.isSystem || group.isMock) {
                if (group.isMock) {
                    toast({ title: 'Mock 分组仅用于预览样式', variant: 'info' });
                }
                return;
            }
            showActionSheet({
                title: group.id,
                options: [
                    {
                        title: '重命名',
                        onPress: () => {
                            setPendingGroupId(group.id);
                            setInputValue(group.id);
                            setInputError('');
                            setRenamingVisible(true);
                        },
                    },
                    {
                        title: '删除',
                        destructive: true,
                        icon: <Trash2 size={18} color="#EF4444" />,
                        onPress: () => {
                            setPendingGroupId(group.id);
                            setDeleteVisible(true);
                        },
                    },
                ],
            });
        },
        [showActionSheet, toast],
    );

    const getRowCount = React.useCallback(
        (groupId: string) => {
            return groupCounts[groupId] ?? 0;
        },
        [groupCounts],
    );

    const getGroupIcon = React.useCallback((groupId: string): React.ComponentType<LucideProps> => {
        if (groupId === SYSTEM_GROUPS.recentlyDeleted) {
            return Trash2;
        }
        if (groupId === SYSTEM_GROUPS.meeting) {
            return Mic;
        }
        return CassetteTape;
    }, []);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right', 'bottom'] }} scrollable={false}>
            <SelectionModeLayout left="分组" isSelectionMode={false} showBackButton onBackPress={() => router.back()} />

            <View className="px-4 pt-2">
                <List
                    contentStyle={{ backgroundColor: cardColor }}
                    footer={
                        <View className="mb-2 mt-4 flex-row items-center justify-between">
                            <TextX variant="subtitle">我的分组</TextX>
                            <Pressable onPress={() => setCreatingVisible(true)}>
                                <TextX style={{ color: primaryColor }}>新建</TextX>
                            </Pressable>
                        </View>
                    }>
                    <ListItem
                        icon={getGroupIcon(SYSTEM_GROUPS.all)}
                        iconProps={{ color: iconColor }}
                        title={getGroupLabel(SYSTEM_GROUPS.all)}
                        titleClassName={selectedGroupId === SYSTEM_GROUPS.all ? 'font-semibold' : undefined}
                        rightText={getRowCount(SYSTEM_GROUPS.all)}
                        showChevron
                        backgroundColor={selectedGroupId === SYSTEM_GROUPS.all ? secondaryColor : cardColor}
                        onPress={() => setSelectedGroup(SYSTEM_GROUPS.all)}
                    />
                </List>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                <View className="px-4 pb-4">
                    <List contentStyle={{ backgroundColor: cardColor }}>
                        {groups.map((group, index) => (
                            <ListItem
                                key={group.id}
                                icon={getGroupIcon(group.id)}
                                iconProps={{ color: iconColor }}
                                title={getGroupLabel(group.id)}
                                titleClassName={selectedGroupId === group.id ? 'font-semibold' : undefined}
                                rightText={getRowCount(group.id)}
                                showChevron
                                backgroundColor={selectedGroupId === group.id ? secondaryColor : cardColor}
                                showDivider={index < groups.length - 1}
                                dividerColor={dividerColor}
                                onPress={() => setSelectedGroup(group.id)}
                                onLongPress={() => openGroupActions(group)}
                            />
                        ))}
                    </List>
                </View>
            </ScrollView>

            <NameInputDialog
                isVisible={creatingVisible}
                onClose={() => {
                    if (submitting) return;
                    setCreatingVisible(false);
                    setInputError('');
                    setInputValue('');
                }}
                title="新建分组"
                description="输入分组名称"
                value={inputValue}
                error={inputError}
                placeholder="分组名称"
                isSubmitting={submitting}
                onChangeText={text => {
                    setInputValue(text);
                    if (inputError) {
                        setInputError(validateGroupName(text) ?? '');
                    }
                }}
                onConfirm={handleCreate}
            />

            <NameInputDialog
                isVisible={renamingVisible}
                onClose={() => {
                    if (submitting) return;
                    setRenamingVisible(false);
                    setPendingGroupId(null);
                    setInputError('');
                    setInputValue('');
                }}
                title="重命名分组"
                description="输入新的分组名称"
                value={inputValue}
                error={inputError}
                placeholder="分组名称"
                isSubmitting={submitting}
                onChangeText={text => {
                    setInputValue(text);
                    if (inputError) {
                        setInputError(validateGroupName(text, pendingGroupId) ?? '');
                    }
                }}
                onConfirm={handleRename}
            />

            <AlertDialog
                isVisible={deleteVisible}
                onClose={() => {
                    if (submitting) return;
                    setDeleteVisible(false);
                    setPendingGroupId(null);
                }}
                title="确认删除分组"
                confirmText="确认删除"
                cancelText="取消"
                confirmButtonProps={{ variant: 'destructive', disabled: submitting }}
                cancelButtonProps={{ disabled: submitting }}
                onConfirm={handleDelete}>
                <TextX>删除后不可恢复，是否继续？</TextX>
            </AlertDialog>

            {ActionSheet}
        </DefaultLayout>
    );
}
