import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { useToast } from '~/components/ui/toast';
import { getCurrentRecordingFolderName } from '~/data/mmkv/app-config';
import { getCurrentModel } from '~/data/mmkv/model-selection';
import { upsertRecordingMeta } from '~/data/sqlite/services/recordings.service';
import { useWavRecording } from '~/features/record/hooks/useWavRecording';
import { useDirtyBackGuard } from '~/features/session-editor/hooks/use-dirty-back-guard';
import type { EditorTabValue } from '~/features/session-editor/types';
import SherpaOnnx, { getSherpaDownloadedModelOptions } from '~/modules/sherpa';

type ConfirmButtonVariant = 'primary' | 'destructive';

type ConfirmDialogState = {
    isVisible: boolean;
    title: string;
    description: string;
    confirmText: string;
    confirmButtonProps?: { variant?: ConfirmButtonVariant };
    onConfirm?: () => void;
    onCancel?: () => void;
};

function getRecordingsDir(folderName?: string | null): string {
    if (!FileSystem.documentDirectory) {
        throw new Error('文件系统目录不可用');
    }
    const baseDir = `${FileSystem.documentDirectory}recordings/`;
    if (!folderName) {
        return baseDir;
    }
    return `${baseDir}${folderName}/`;
}

function createRecordingPath(folderName?: string | null): string {
    const fileName = `record-${Date.now()}.wav`;
    return `${getRecordingsDir(folderName)}${fileName}`;
}

export function useRecordSession() {
    const REALTIME_RECORD_MODE = 'official_simulated_vad' as const;
    const realtimeModelId = React.useRef(getCurrentModel()).current;
    const realtimeOptions = React.useMemo(
        () =>
            getSherpaDownloadedModelOptions(realtimeModelId, {
                debug: true,
                enableDenoise: false,
                enableSpeakerDiarization: false,
                wavReadMode: 'streaming',
            }),
        [realtimeModelId],
    );

    const [confirmDialogState, setConfirmDialogState] = React.useState<ConfirmDialogState>({
        isVisible: false,
        title: '',
        description: '',
        confirmText: '确定',
    });
    const [displayName, setDisplayName] = React.useState('新录音');
    const [editorTab, setEditorTab] = React.useState<EditorTabValue>('remark');
    const [headerAtMs, setHeaderAtMs] = React.useState(() => Date.now());
    const [recordingEndedAtMs, setRecordingEndedAtMs] = React.useState<number | null>(null);
    const recordingStartedAtRef = React.useRef<number | null>(null);

    const navigation = useNavigation();
    const { toast } = useToast();
    const { resetDirtyBackGuard, runDirtyBackAttempt } = useDirtyBackGuard({
        timeoutMs: 2000,
        onFirstBackWhenDirty: () => {
            toast({
                message: '再次点击按钮返回',
                variant: 'warning',
                preset: 'compact',
            });
        },
    });

    const showRecordError = useCallback(
        (description: string) => {
            toast({
                title: '录音失败',
                description,
                variant: 'error',
            });
        },
        [toast],
    );

    const { phase, isPaused, actionLoading, elapsedText, startRecord, pauseRecord, resumeRecord, stopRecord } = useWavRecording({
        sampleRate: 16000,
        createTargetPath: async () => {
            const recordingFolderName = getCurrentRecordingFolderName();
            const directory = getRecordingsDir(recordingFolderName);
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            return createRecordingPath(recordingFolderName);
        },
        onStart: () => {
            const startedAt = Date.now();
            recordingStartedAtRef.current = startedAt;
            setHeaderAtMs(startedAt);
            setRecordingEndedAtMs(null);
        },
        onStop: async wavResult => {
            if (!wavResult.path) {
                showRecordError('未能获取录音文件，请重试');
                return;
            }

            const durationMs = wavResult.sampleRate > 0 ? Math.round((wavResult.numSamples / wavResult.sampleRate) * 1000) : null;
            const sessionId = wavResult.sessionId?.trim() || undefined;

            try {
                const recordedAtMs = recordingStartedAtRef.current ?? Date.now();
                const recordingGroupName = getCurrentRecordingFolderName();
                await upsertRecordingMeta({
                    path: wavResult.path,
                    groupName: recordingGroupName,
                    sampleRate: wavResult.sampleRate,
                    numSamples: wavResult.numSamples,
                    durationMs,
                    recordedAtMs,
                    sessionId,
                });

                toast({
                    title: '录音已保存',
                    variant: 'success',
                });

                try {
                    await SherpaOnnx.stopRealtimeAsr();
                } catch (error) {
                    console.warn('[record] stop realtime asr failed', error);
                }
            } catch (error) {
                console.error('[record] upsertRecordingMeta failed', error);
                showRecordError('录音已生成，但保存元数据失败');
            } finally {
                recordingStartedAtRef.current = null;
                setRecordingEndedAtMs(Date.now());
            }
        },
        onPermissionDenied: () => {
            showRecordError('麦克风权限被拒绝');
        },
        onError: error => {
            console.error('[record] recording error', error);
            showRecordError(error.message || '录音过程中发生错误');
        },
        realtimeMode: REALTIME_RECORD_MODE,
        realtimeOptions,
    });

    const isRecordingOrPaused = phase === 'recording' || phase === 'paused' || phase === 'stopping';
    const isStopping = phase === 'stopping';
    const canStop = phase === 'recording' || phase === 'paused';
    const isIdleLike = phase === 'idle' || phase === 'error';
    const isMicVisualState = isIdleLike || isStopping;
    const handleLeftAction = useCallback(() => {
        if (isStopping || actionLoading) {
            return;
        }
        if (isIdleLike) {
            startRecord();
            return;
        }
        if (isPaused) {
            resumeRecord();
            return;
        }
        pauseRecord();
    }, [actionLoading, isIdleLike, isPaused, isStopping, pauseRecord, resumeRecord, startRecord]);

    const handleConfirmStop = useCallback(() => {
        if (!canStop || isStopping) {
            return;
        }

        setConfirmDialogState({
            isVisible: true,
            title: '结束录音',
            description: '确认结束并保存当前录音吗？',
            confirmText: '结束',
            confirmButtonProps: { variant: 'destructive' },
            onConfirm: () => {
                void stopRecord();
            },
        });
    }, [canStop, isStopping, stopRecord]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', event => {
            if (!canStop || isStopping) {
                return;
            }

            event.preventDefault();
            void runDirtyBackAttempt({
                isDirty: true,
                onConfirmed: async () => {
                    try {
                        await stopRecord();
                        resetDirtyBackGuard();
                        navigation.dispatch(event.data.action);
                    } catch {
                        // stopRecord already reports errors via toast
                    }
                },
            });
        });

        return unsubscribe;
    }, [navigation, canStop, isStopping, stopRecord, runDirtyBackAttempt, resetDirtyBackGuard]);

    const closeConfirmDialog = useCallback(() => {
        setConfirmDialogState(prev => ({ ...prev, isVisible: false, onCancel: undefined }));
    }, []);

    const cancelConfirmDialog = useCallback(() => {
        confirmDialogState.onCancel?.();
        setConfirmDialogState(prev => ({ ...prev, isVisible: false, onCancel: undefined }));
    }, [confirmDialogState.onCancel]);

    const handleBackPress = useCallback(() => {
        if (!canStop || isStopping) {
            resetDirtyBackGuard();
            navigation.goBack();
            return;
        }

        void runDirtyBackAttempt({
            isDirty: true,
            onConfirmed: async () => {
                try {
                    await stopRecord();
                    resetDirtyBackGuard();
                    navigation.goBack();
                } catch {
                    // stopRecord already reports errors via toast
                }
            },
        });
    }, [canStop, isStopping, navigation, stopRecord, runDirtyBackAttempt, resetDirtyBackGuard]);

    useEffect(() => {
        return () => {
            resetDirtyBackGuard();
        };
    }, [resetDirtyBackGuard]);

    return {
        displayName,
        setDisplayName,
        editorTab,
        setEditorTab,
        headerAtMs,
        confirmDialogState,
        closeConfirmDialog,
        cancelConfirmDialog,
        phase,
        isPaused,
        actionLoading,
        elapsedText,
        isRecordingOrPaused,
        isStopping,
        canStop,
        isIdleLike,
        isMicVisualState,
        handleLeftAction,
        handleConfirmStop,
        handleBackPress,
        recordingEndedAtMs,
    };
}
