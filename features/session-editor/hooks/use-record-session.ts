import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { useToast } from '~/components/ui/toast';
import { getCurrentRecordingFolderName } from '~/data/mmkv/app-config';
import type { RecordingMarker } from '~/data/sqlite/services/recordings.service';
import {
    formatRecordingDisplayName,
    loadRecordSessionDraft,
    saveRecordSessionDraft,
    type RecordSessionDraft,
} from '~/features/session-editor/services/record-session-draft';
import { discardRecordSessionDraft } from '~/features/session-editor/services/record-session-workflow';
import { useWavRecording } from '~/features/record/hooks/use-wav-recording';
import { useDirtyBackGuard } from '~/features/session-editor/hooks/use-dirty-back-guard';
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

type WaveformPoint = {
    level: number;
    timeMs: number;
};

type ActiveDraft = RecordSessionDraft & {
    sessionId: string;
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

function normalizeMarkers(markers: RecordingMarker[], sessionId: string): RecordingMarker[] {
    return markers.map((marker, index) => ({
        ...marker,
        sessionId,
        timeMs: Math.max(0, Math.floor(marker.timeMs)),
        noteText: marker.noteText ?? '',
        sortOrder: index,
    }));
}

export function useRecordSession() {
    const [confirmDialogState, setConfirmDialogState] = React.useState<ConfirmDialogState>({
        isVisible: false,
        title: '',
        description: '',
        confirmText: '确定',
    });
    const [activeDraft, setActiveDraft] = React.useState<ActiveDraft | null>(null);
    const [waveformPoints, setWaveformPoints] = React.useState<WaveformPoint[]>([]);

    const navigation = useNavigation();
    const router = useRouter();
    const { toast } = useToast();
    const lastPersistSecondRef = React.useRef(-1);
    const lastWaveformLevelRef = React.useRef(0);
    const elapsedMsRef = React.useRef(0);
    const { resetDirtyBackGuard, runDirtyBackAttempt } = useDirtyBackGuard({
        timeoutMs: 2000,
        onFirstBackWhenDirty: () => {
            toast({
                message: '再次点击返回以进入保存确认',
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

    const persistDraft = useCallback(async (draft: RecordSessionDraft | null) => {
        if (!draft) {
            return;
        }
        await saveRecordSessionDraft({
            ...draft,
            markers: normalizeMarkers(draft.markers, draft.sessionId),
            updatedAtMs: Date.now(),
        });
    }, []);

    const {
        phase,
        isPaused,
        actionLoading,
        elapsedMs,
        elapsedPreciseText,
        startRecord,
        pauseRecord,
        resumeRecord,
    } = useWavRecording({
        sampleRate: 16000,
        createTargetPath: async () => {
            const recordingFolderName = getCurrentRecordingFolderName();
            const directory = getRecordingsDir(recordingFolderName);
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            return createRecordingPath(recordingFolderName);
        },
        onStart: result => {
            const startedAt = Date.now();
            lastPersistSecondRef.current = -1;
            lastWaveformLevelRef.current = 0;
            const nextDraft: ActiveDraft = {
                sessionId: result.sessionId?.trim() || `session-${startedAt}`,
                outputPath: result.path,
                displayName: formatRecordingDisplayName(startedAt),
                noteText: '',
                groupName: getCurrentRecordingFolderName(),
                recordedAtMs: startedAt,
                durationMs: 0,
                state: 'recording',
                markers: [],
                updatedAtMs: startedAt,
            };
            setWaveformPoints([]);
            setActiveDraft(nextDraft);
            void persistDraft(nextDraft);
        },
        onPermissionDenied: () => {
            showRecordError('麦克风权限被拒绝');
        },
        onError: error => {
            console.error('[record] recording error', error);
            showRecordError(error.message || '录音过程中发生错误');
        },
    });

    const syncDraftOnFocus = useCallback(async () => {
        if (!activeDraft?.sessionId) {
            return;
        }
        const latestDraft = await loadRecordSessionDraft(activeDraft.sessionId);
        if (!latestDraft) {
            return;
        }
        setActiveDraft(latestDraft);
    }, [activeDraft?.sessionId]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            void syncDraftOnFocus();
        });
        return unsubscribe;
    }, [navigation, syncDraftOnFocus]);

    useEffect(() => {
        elapsedMsRef.current = elapsedMs;
    }, [elapsedMs]);

    useEffect(() => {
        if (!activeDraft?.sessionId) {
            return;
        }

        const subscription = SherpaOnnx.addWavRecordingWaveformListener(event => {
            const rawLevel = Math.max(event.peak * 0.9, event.rms * 1.35, event.peak * 0.35 + event.rms * 1.1);
            const smoothedLevel = lastWaveformLevelRef.current * 0.32 + rawLevel * 0.68;
            const nextValue = Math.max(0, Math.min(1, smoothedLevel));
            lastWaveformLevelRef.current = nextValue;
            setWaveformPoints(prev => {
                const next = [
                    ...prev,
                    {
                        level: nextValue,
                        timeMs: elapsedMsRef.current,
                    },
                ];
                return next.length > 480 ? next.slice(next.length - 480) : next;
            });
        });

        return () => subscription.remove();
    }, [activeDraft?.sessionId]);

    useEffect(() => {
        if (!activeDraft?.sessionId) {
            return;
        }
        const wholeSecond = Math.floor(elapsedMs / 1000);
        if (wholeSecond <= lastPersistSecondRef.current) {
            return;
        }
        lastPersistSecondRef.current = wholeSecond;
        void persistDraft({
            ...activeDraft,
            durationMs: elapsedMs,
            state: phase === 'paused' ? 'confirming' : 'recording',
        });
    }, [activeDraft, elapsedMs, persistDraft, phase]);

    const isRecordingOrPaused = phase === 'recording' || phase === 'paused' || phase === 'stopping';
    const isStopping = phase === 'stopping';
    const canStop = phase === 'recording' || phase === 'paused';
    const isIdleLike = phase === 'idle' || phase === 'error';

    const updateDraft = useCallback(
        (updater: (draft: ActiveDraft) => ActiveDraft) => {
            setActiveDraft(prev => {
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

    const setNoteText = useCallback(
        (nextText: string) => {
            updateDraft(draft => ({
                ...draft,
                noteText: nextText,
            }));
        },
        [updateDraft],
    );

    const handleLeftAction = useCallback(() => {
        if (isStopping || actionLoading) {
            return;
        }
        if (isIdleLike) {
            void startRecord();
            return;
        }
        if (isPaused) {
            void resumeRecord();
            return;
        }
        void pauseRecord();
    }, [actionLoading, isIdleLike, isPaused, isStopping, pauseRecord, resumeRecord, startRecord]);

    const goToReview = useCallback(async () => {
        if (!activeDraft?.sessionId) {
            return;
        }
        if (phase === 'recording') {
            await pauseRecord();
        }
        const nextDraft: ActiveDraft = {
            ...activeDraft,
            durationMs: elapsedMs,
            state: 'confirming',
        };
        setActiveDraft(nextDraft);
        await persistDraft(nextDraft);
        router.push({
            pathname: '/record-review',
            params: { sessionId: nextDraft.sessionId },
        });
    }, [activeDraft, elapsedMs, pauseRecord, persistDraft, phase, router]);

    const handleConfirmStop = useCallback(() => {
        if (!canStop || isStopping) {
            return;
        }
        void goToReview();
    }, [canStop, goToReview, isStopping]);

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
                await goToReview();
                resetDirtyBackGuard();
            },
        });
    }, [canStop, goToReview, isStopping, navigation, resetDirtyBackGuard, runDirtyBackAttempt]);

    const leaveRecordPage = useCallback(() => {
        resetDirtyBackGuard();
        navigation.goBack();
    }, [navigation, resetDirtyBackGuard]);

    useEffect(() => {
        return () => {
            resetDirtyBackGuard();
        };
    }, [resetDirtyBackGuard]);

    const handleAddMarker = useCallback(() => {
        if (!activeDraft || !isRecordingOrPaused) {
            return;
        }

        const nextMarkers: RecordingMarker[] = [
            ...activeDraft.markers,
            {
                sessionId: activeDraft.sessionId,
                timeMs: elapsedMs,
                noteText: '',
                sortOrder: activeDraft.markers.length,
            },
        ];

        setActiveDraft({
            ...activeDraft,
            markers: nextMarkers,
        });
        void persistDraft({
            ...activeDraft,
            markers: nextMarkers,
            durationMs: elapsedMs,
        });
        toast({
            message: `已标记 ${elapsedPreciseText.replace('.', ':')}`,
            variant: 'success',
            preset: 'compact',
        });
    }, [activeDraft, elapsedMs, elapsedPreciseText, isRecordingOrPaused, persistDraft, toast]);

    const discardSession = useCallback(async () => {
        if (!activeDraft) {
            return;
        }
        try {
            if (SherpaOnnx.isWavRecording()) {
                await SherpaOnnx.stopWavRecording().catch(error => {
                    console.warn('[record] stop before discard failed', error);
                });
            }
            await discardRecordSessionDraft(activeDraft);
        } catch (error) {
            console.warn('[record] discard draft failed', error);
        }
    }, [activeDraft]);

    return {
        noteText: activeDraft?.noteText ?? '',
        setNoteText,
        displayName: activeDraft?.displayName ?? '录音',
        recordedAtMs: activeDraft?.recordedAtMs ?? Date.now(),
        markers: activeDraft?.markers ?? [],
        sessionId: activeDraft?.sessionId ?? null,
        waveformPoints,
        confirmDialogState,
        closeConfirmDialog,
        cancelConfirmDialog,
        phase,
        isPaused,
        actionLoading,
        elapsedMs,
        elapsedPreciseText,
        isRecordingOrPaused,
        isStopping,
        canStop,
        isIdleLike,
        handleAddMarker,
        handleLeftAction,
        handleConfirmStop,
        goToReview,
        handleBackPress,
        leaveRecordPage,
        discardSession,
    };
}
