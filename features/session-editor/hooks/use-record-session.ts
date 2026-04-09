import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { useToast } from '~/components/ui/toast';
import {
    getCurrentRecordingFolderName,
    getFinalTranscribeUseSpeakerDiarization,
    getFinalTranscribeUseVad,
} from '~/data/mmkv/app-config';
import { getCurrentModel } from '~/data/mmkv/model-selection';
import { upsertRecordingMeta } from '~/data/sqlite/services/recordings.service';
import { useWavRecording } from '~/features/record/hooks/useWavRecording';
import type { EditorTabValue } from '~/features/session-editor/types';
import { buildDefaultTranscribeOptions, transcribeFileWithTiming } from '~/integrations/sherpa/recognition-service';
import SherpaOnnx from '~/modules/sherpa';

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
    const [confirmDialogState, setConfirmDialogState] = React.useState<ConfirmDialogState>({
        isVisible: false,
        title: '',
        description: '',
        confirmText: '确定',
    });
    const [displayName, setDisplayName] = React.useState('新录音');
    const [editorTab, setEditorTab] = React.useState<EditorTabValue>('remark');
    const [headerAtMs, setHeaderAtMs] = React.useState(() => Date.now());
    const [activeRecordingPath, setActiveRecordingPath] = React.useState<string | null>(null);
    const [finalTranscribeUseVad, setFinalTranscribeUseVad] = React.useState(() => getFinalTranscribeUseVad());
    const [finalTranscribeUseSpeakerDiarization, setFinalTranscribeUseSpeakerDiarization] = React.useState(() =>
        getFinalTranscribeUseSpeakerDiarization(),
    );
    const [liveTranscriptText, setLiveTranscriptText] = React.useState('');
    const [liveTranscriptStatusText, setLiveTranscriptStatusText] = React.useState('待开始录音');
    const [liveTranscriptUpdatedAtMs, setLiveTranscriptUpdatedAtMs] = React.useState<number | null>(null);
    const recordingStartedAtRef = React.useRef<number | null>(null);

    const navigation = useNavigation();
    const { toast } = useToast();

    const showRecordError = useCallback(
        (description: string) => {
            toast({
                title: '录音失败',
                description,
                variant: 'error',
                duration: 5000,
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
        onStart: startResult => {
            const startedAt = Date.now();
            recordingStartedAtRef.current = startedAt;
            setHeaderAtMs(startedAt);
            setActiveRecordingPath(startResult.path);
            setFinalTranscribeUseVad(getFinalTranscribeUseVad());
            setFinalTranscribeUseSpeakerDiarization(getFinalTranscribeUseSpeakerDiarization());
            setLiveTranscriptText('');
            setLiveTranscriptUpdatedAtMs(null);
            setLiveTranscriptStatusText('实时转写进行中...');
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
                await upsertRecordingMeta({
                    path: wavResult.path,
                    sampleRate: wavResult.sampleRate,
                    numSamples: wavResult.numSamples,
                    durationMs,
                    recordedAtMs,
                    sessionId,
                });

                toast({
                    title: '录音已保存',
                    variant: 'success',
                    duration: 3000,
                });

                try {
                    const realtimeSnapshot = SherpaOnnx.getRealtimeAsrSnapshot();
                    if (realtimeSnapshot.text.trim()) {
                        setLiveTranscriptText(realtimeSnapshot.text.trim());
                    }
                    await SherpaOnnx.stopRealtimeAsr();
                    const { transcribe } = await transcribeFileWithTiming({
                        filePath: wavResult.path,
                        modelId: getCurrentModel(),
                        overrides: {
                            enableVad: finalTranscribeUseVad,
                            enableSpeakerDiarization: finalTranscribeUseSpeakerDiarization,
                        },
                    });
                    setLiveTranscriptText(transcribe.result.text.trim());
                    setLiveTranscriptStatusText('最终转写已完成');
                } catch (error) {
                    console.warn('[record] final transcribe failed', error);
                    setLiveTranscriptStatusText('实时转写已结束（最终转写失败）');
                }
            } catch (error) {
                console.error('[record] upsertRecordingMeta failed', error);
                showRecordError('录音已生成，但保存元数据失败');
            } finally {
                recordingStartedAtRef.current = null;
                setActiveRecordingPath(null);
            }
        },
        onPermissionDenied: () => {
            showRecordError('麦克风权限被拒绝');
        },
        onError: error => {
            console.error('[record] recording error', error);
            showRecordError(error.message || '录音过程中发生错误');
        },
        realtimeMode: 'official_simulated_vad',
        realtimeOptions: buildDefaultTranscribeOptions(undefined, {
            enableVad: true,
            enableSpeakerDiarization: false,
            wavReadMode: 'streaming',
        }),
    });

    const isRecordingOrPaused = phase === 'recording' || phase === 'paused' || phase === 'stopping';
    const isStopping = phase === 'stopping';
    const canStop = phase === 'recording' || phase === 'paused';
    const isIdleLike = phase === 'idle' || phase === 'error';
    const isMicVisualState = isIdleLike || isStopping;
    React.useEffect(() => {
        const shouldPoll = phase === 'recording' || phase === 'paused';
        if (!shouldPoll) {
            return;
        }
        const poll = () => {
            try {
                const snapshot = SherpaOnnx.getRealtimeAsrSnapshot();
                const nextText = snapshot.text.trim();
                setLiveTranscriptStatusText(phase === 'paused' ? '暂停中，正在收尾转写...' : '实时转写中...');
                if (!nextText) {
                    return;
                }
                setLiveTranscriptText(nextText);
                setLiveTranscriptUpdatedAtMs(snapshot.updatedAtMs > 0 ? snapshot.updatedAtMs : Date.now());
            } catch (error) {
                console.warn('[record] poll realtime snapshot failed', error);
                setLiveTranscriptStatusText('实时转写暂不可用，稍后重试');
            }
        };
        void poll();
        const timer = setInterval(poll, 220);
        return () => {
            clearInterval(timer);
        };
    }, [phase]);

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
            setConfirmDialogState({
                isVisible: true,
                title: '结束录音',
                description: '当前正在录音，是否结束并返回？',
                confirmText: '结束并返回',
                confirmButtonProps: { variant: 'destructive' },
                onConfirm: () => {
                    void (async () => {
                        try {
                            await stopRecord();
                            navigation.dispatch(event.data.action);
                        } catch {
                            // stopRecord already reports errors via toast
                        }
                    })();
                },
            });
        });

        return unsubscribe;
    }, [navigation, canStop, isStopping, stopRecord]);

    const closeConfirmDialog = useCallback(() => {
        setConfirmDialogState(prev => ({ ...prev, isVisible: false, onCancel: undefined }));
    }, []);

    const cancelConfirmDialog = useCallback(() => {
        confirmDialogState.onCancel?.();
        setConfirmDialogState(prev => ({ ...prev, isVisible: false, onCancel: undefined }));
    }, [confirmDialogState.onCancel]);

    const handleBackPress = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

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
        liveTranscriptText,
        liveTranscriptStatusText,
        liveTranscriptUpdatedAtMs,
    };
}
