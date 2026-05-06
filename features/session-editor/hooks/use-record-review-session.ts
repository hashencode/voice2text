import { router } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { useToast } from '~/components/ui/toast';
import { listFolders, type Folder } from '~/data/sqlite/services/folders.service';
import type { RecordingMarker } from '~/data/sqlite/services/recordings.service';
import {
    loadRecordSessionDraft,
    saveRecordSessionDraft,
    type RecordSessionDraft,
} from '~/features/session-editor/services/record-session-draft';
import {
    discardRecordSessionDraft,
    finalizeRecordSessionDraft,
} from '~/features/session-editor/services/record-session-workflow';
import SherpaOnnx from '~/modules/sherpa';

type ConfirmButtonVariant = 'primary' | 'destructive';

type ConfirmDialogState = {
    isVisible: boolean;
    title: string;
    description: string;
    confirmText: string;
    cancelText: string;
    confirmButtonProps?: { variant?: ConfirmButtonVariant };
    onConfirm?: () => void;
    onCancel?: () => void;
};

function normalizeMarkers(markers: RecordingMarker[], sessionId: string): RecordingMarker[] {
    return markers.map((marker, index) => ({
        ...marker,
        sessionId,
        noteText: marker.noteText ?? '',
        sortOrder: index,
    }));
}

export function useRecordReviewSession(sessionId?: string) {
    const { toast } = useToast();
    const [draft, setDraft] = React.useState<RecordSessionDraft | null>(null);
    const [folders, setFolders] = React.useState<Folder[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [confirmDialogState, setConfirmDialogState] = React.useState<ConfirmDialogState>({
        isVisible: false,
        title: '',
        description: '',
        confirmText: '确定',
        cancelText: '取消',
    });

    useEffect(() => {
        let isActive = true;

        (async () => {
            if (!sessionId) {
                setIsLoading(false);
                return;
            }

            try {
                const [loadedDraft, folderRows] = await Promise.all([loadRecordSessionDraft(sessionId), listFolders()]);
                if (!isActive) {
                    return;
                }
                if (!loadedDraft) {
                    toast({
                        title: '未找到录音草稿',
                        description: '这条录音可能已经处理完成。',
                        variant: 'warning',
                    });
                    router.replace('/');
                    return;
                }
                setDraft({
                    ...loadedDraft,
                    markers: normalizeMarkers(loadedDraft.markers, loadedDraft.sessionId),
                });
                setFolders(folderRows);
            } catch (error) {
                if (!isActive) {
                    return;
                }
                toast({
                    title: '加载失败',
                    description: (error as Error).message ?? '无法打开录音确认页',
                    variant: 'error',
                });
                router.replace('/');
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        })();

        return () => {
            isActive = false;
        };
    }, [sessionId, toast]);

    const persistDraft = useCallback(async (nextDraft: RecordSessionDraft | null) => {
        if (!nextDraft) {
            return;
        }
        await saveRecordSessionDraft({
            ...nextDraft,
            state: 'confirming',
            markers: normalizeMarkers(nextDraft.markers, nextDraft.sessionId),
            updatedAtMs: Date.now(),
        });
    }, []);

    const updateDraft = useCallback(
        (updater: (prev: RecordSessionDraft) => RecordSessionDraft) => {
            setDraft(prev => {
                if (!prev) {
                    return prev;
                }
                const nextDraft = updater(prev);
                void persistDraft(nextDraft);
                return nextDraft;
            });
        },
        [persistDraft],
    );

    const setDisplayName = useCallback(
        (value: string) => {
            updateDraft(prev => ({
                ...prev,
                displayName: value,
            }));
        },
        [updateDraft],
    );

    const setNoteText = useCallback(
        (value: string) => {
            updateDraft(prev => ({
                ...prev,
                noteText: value,
            }));
        },
        [updateDraft],
    );

    const setGroupName = useCallback(
        (value: string) => {
            updateDraft(prev => ({
                ...prev,
                groupName: value || null,
            }));
        },
        [updateDraft],
    );

    const updateMarkerNote = useCallback(
        (index: number, value: string) => {
            updateDraft(prev => ({
                ...prev,
                markers: prev.markers.map((marker, markerIndex) =>
                    markerIndex === index
                        ? {
                              ...marker,
                              noteText: value,
                          }
                        : marker,
                ),
            }));
        },
        [updateDraft],
    );

    const closeConfirmDialog = useCallback(() => {
        setConfirmDialogState(prev => ({ ...prev, isVisible: false, onConfirm: undefined, onCancel: undefined }));
    }, []);

    const handleContinueRecording = useCallback(async () => {
        if (!draft) {
            router.replace('/record');
            return;
        }
        const nextDraft = {
            ...draft,
            state: 'recording' as const,
        };
        await saveRecordSessionDraft({
            ...nextDraft,
            updatedAtMs: Date.now(),
        });
        if (SherpaOnnx.isWavRecording() && SherpaOnnx.isWavRecordingPaused()) {
            await SherpaOnnx.resumeWavRecording();
        }
        router.back();
    }, [draft]);

    const handleSave = useCallback(async () => {
        if (!draft || isSaving) {
            return;
        }
        setIsSaving(true);
        try {
            await persistDraft(draft);
            await finalizeRecordSessionDraft(draft);
            toast({
                title: '已保存录音',
                description: '这条录音已经回到列表顶部。',
                variant: 'success',
            });
            router.replace('/');
        } catch (error) {
            toast({
                title: '保存失败',
                description: (error as Error).message ?? '请稍后重试',
                variant: 'error',
            });
        } finally {
            setIsSaving(false);
        }
    }, [draft, isSaving, persistDraft, toast]);

    const handleDiscard = useCallback(() => {
        if (!draft || isSaving) {
            return;
        }
        setConfirmDialogState({
            isVisible: true,
            title: '放弃本次录音',
            description: '这会删除临时音频、速记草稿和全部标记，且无法恢复。',
            confirmText: '放弃',
            cancelText: '继续编辑',
            confirmButtonProps: { variant: 'destructive' },
            onConfirm: () => {
                setConfirmDialogState(prev => ({ ...prev, isVisible: false }));
                setIsSaving(true);
                void discardRecordSessionDraft(draft)
                    .then(() => {
                        toast({
                            message: '已放弃本次录音',
                            variant: 'info',
                        });
                        router.replace('/');
                    })
                    .catch(error => {
                        toast({
                            title: '放弃失败',
                            description: (error as Error).message ?? '请稍后重试',
                            variant: 'error',
                        });
                    })
                    .finally(() => {
                        setIsSaving(false);
                    });
            },
            onCancel: closeConfirmDialog,
        });
    }, [closeConfirmDialog, draft, isSaving, toast]);

    return {
        draft,
        folders,
        isLoading,
        isSaving,
        setDisplayName,
        setNoteText,
        setGroupName,
        updateMarkerNote,
        handleContinueRecording,
        handleSave,
        handleDiscard,
        confirmDialogState,
        closeConfirmDialog,
    };
}
