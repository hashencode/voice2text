import { useFocusEffect, useRouter } from 'expo-router';
import { PencilLine, Plus, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { useActionSheet } from '~/components/ui/action-sheet';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { IconButton } from '~/components/ui/icon-button';
import { PullToRefreshScrollView } from '~/components/ui/pull-to-refresh-scrollview';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { getSelectedRecordingGroupId, setCurrentRecordingFolderName, setSelectedRecordingGroupId } from '~/data/mmkv/app-config';
import { getGroupLabel, isReservedGroupName, SYSTEM_GROUPS } from '~/data/sqlite/group-model';
import { createFolder, deleteFolder, listFolders, updateFolderName } from '~/data/sqlite/services/folders.service';
import NameInputDialog from '~/features/home/components/name-input-dialog';

type GroupItem = {
    id: string;
    isSystem: boolean;
};

export default function RecordingGroupsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [groups, setGroups] = React.useState<GroupItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [creatingVisible, setCreatingVisible] = React.useState(false);
    const [renamingVisible, setRenamingVisible] = React.useState(false);
    const [deleteVisible, setDeleteVisible] = React.useState(false);
    const [inputValue, setInputValue] = React.useState('');
    const [inputError, setInputError] = React.useState('');
    const [pendingGroupId, setPendingGroupId] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [selectedGroupId, setSelectedGroupIdState] = React.useState(() => getSelectedRecordingGroupId());
    const { show: showActionSheet, ActionSheet } = useActionSheet();

    const loadGroups = React.useCallback(async () => {
        setLoading(true);
        try {
            const rows = await listFolders();
            const customGroups = rows
                .map(row => row.name.trim())
                .filter(name => name && !isReservedGroupName(name))
                .map(name => ({ id: name, isSystem: false as const }));

            const systemGroups: GroupItem[] = [
                { id: SYSTEM_GROUPS.meeting, isSystem: true },
                { id: SYSTEM_GROUPS.recentlyDeleted, isSystem: true },
            ];

            setGroups([...systemGroups, ...customGroups]);
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

    return (
        <DefaultLayout
            safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}
            scrollable={false}
            headTitle="分组"
            headExtra={<IconButton icon={Plus} size="sm" onPress={() => setCreatingVisible(true)} />}>
            <View className="px-4 pt-4">
                <TextX variant="subtitle" className="mb-2">
                    全部音频
                </TextX>
                <Pressable className="rounded-2xl border px-4 py-3" onPress={() => setSelectedGroup(SYSTEM_GROUPS.all)}>
                    <TextX className={selectedGroupId === SYSTEM_GROUPS.all ? 'font-semibold' : ''}>
                        {getGroupLabel(SYSTEM_GROUPS.all)}
                    </TextX>
                </Pressable>

                <View className="mb-2 mt-6 flex-row items-center justify-between">
                    <TextX variant="subtitle">我的分组</TextX>
                    <Pressable onPress={() => setCreatingVisible(true)}>
                        <TextX className="text-primary">新建分组</TextX>
                    </Pressable>
                </View>
            </View>

            <PullToRefreshScrollView
                onRefresh={loadGroups}
                isEmpty={!loading && groups.length === 0}
                emptyText="暂无分组"
                isLoadedAll={!loading && groups.length > 0}
                contentContainerStyle={{ paddingBottom: 16 }}>
                <View className="px-4 pb-4">
                    {groups.map(group => (
                        <Pressable
                            key={group.id}
                            className="mb-2 flex-row items-center justify-between rounded-2xl border px-4 py-3"
                            onPress={() => setSelectedGroup(group.id)}>
                            <TextX className={selectedGroupId === group.id ? 'font-semibold' : ''}>{getGroupLabel(group.id)}</TextX>
                            {!group.isSystem ? (
                                <IconButton
                                    icon={PencilLine}
                                    size="sm"
                                    onPress={() => {
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
                                    }}
                                />
                            ) : null}
                        </Pressable>
                    ))}
                </View>
            </PullToRefreshScrollView>

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
