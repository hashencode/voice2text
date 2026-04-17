import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useNavigation } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import type { EnrichedTextInputInstance } from 'react-native-enriched';
import { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useActionSheet } from '~/components/ui/action-sheet';
import { useToast } from '~/components/ui/toast';
import {
    findRecordingMetaByPath,
    findRecordingMetaBySourceFileNameAndFileSize,
    upsertRecordingMeta,
    type RecordingMeta,
} from '~/data/sqlite/services/recordings.service';
import { formatImportAudioDefaultName, formatSpeed, toDisplayName } from '~/features/session-editor/services/time-format';
import type { EditorTabValue } from '~/features/session-editor/types';
import { useDirtyBackGuard } from '~/features/session-editor/hooks/use-dirty-back-guard';
import { transcribeFileWithTiming } from '~/modules/sherpa/recognition';
import SherpaOnnx, { ensureModelReady, type DownloadModelProgress, type SherpaModelId } from '~/modules/sherpa';

const PLAYBACK_SPEEDS = [2.0, 1.5, 1.0, 0.9] as const;
const MIN_SAVE_OVERLAY_DURATION_MS = 2000;
const MODEL_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models/';

type RecognitionLanguage = 'zh' | 'en';
type RecognitionMode = 'offline' | 'online';
type RecognitionInstallState = 'ready' | 'installing' | 'failed';
type RecognitionStatusIcon = 'voice-scan' | 'arrow-down-circle' | 'warning-triangle';
type RecognitionState = 'idle' | 'preparing' | 'recognizing' | 'stopped' | 'success' | 'failed';

type UseImportAudioSessionOptions = {
    audioUri?: string;
    audioName?: string | string[];
    noteInputRef?: React.RefObject<EnrichedTextInputInstance | null>;
    fromList?: boolean;
    initialDisplayName?: string;
    initialHeaderAtMs?: number;
};

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

type SessionSnapshot = {
    displayName: string;
    noteRichText: string;
    transcriptText: string;
    summaryText: string;
};

function ensureFileUri(path: string): string {
    if (!path) {
        return path;
    }
    if (path.startsWith('file://') || path.startsWith('content://') || path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    if (path.startsWith('/')) {
        return `file://${path}`;
    }
    return path;
}

function normalizeSourceFileName(name: string): string {
    return name.trim().toLowerCase();
}

function getFileNameFromUri(uri: string): string {
    const cleanUri = uri.split('?')[0];
    const segments = cleanUri.split('/');
    return decodeURIComponent(segments[segments.length - 1] || '导入音频');
}

function getSourceFileName(audioName: string | string[] | undefined, audioUri: string | undefined): string {
    const maybeName = Array.isArray(audioName) ? audioName[0] : audioName;
    const trimmedName = maybeName?.trim();
    if (trimmedName) {
        return trimmedName;
    }
    if (audioUri) {
        return getFileNameFromUri(audioUri);
    }
    return '导入音频';
}

function getFileExtension(name: string): string {
    const cleanName = name.trim();
    const dotIndex = cleanName.lastIndexOf('.');
    if (dotIndex < 0 || dotIndex === cleanName.length - 1) {
        return '';
    }
    return cleanName.slice(dotIndex);
}

function createImportedFileUri(sourceFileName: string): string {
    if (!FileSystem.documentDirectory) {
        throw new Error('文件系统目录不可用');
    }
    const ext = getFileExtension(sourceFileName);
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    return `${FileSystem.documentDirectory}recordings/imported/import-${Date.now()}-${randomSuffix}${ext}`;
}

function toSingleName(name?: string | string[]): string {
    return Array.isArray(name) ? (name[0] ?? '') : (name ?? '');
}

function resolveInitialDisplayName(rawName?: string | string[], fallbackMs?: number): string {
    const singleName = toSingleName(rawName).trim();
    if (!singleName || singleName === '导入音频') {
        return formatImportAudioDefaultName(fallbackMs ?? Date.now());
    }
    return toDisplayName(singleName);
}

function isSameSnapshot(a: SessionSnapshot, b: SessionSnapshot): boolean {
    return (
        a.displayName === b.displayName &&
        a.noteRichText === b.noteRichText &&
        a.transcriptText === b.transcriptText &&
        a.summaryText === b.summaryText
    );
}

function resolveOfflineModelId(language: RecognitionLanguage): SherpaModelId {
    if (language === 'zh') {
        return 'paraformer-zh';
    }
    return 'moonshine-zh';
}

function resolveInstallStatusText(progress: DownloadModelProgress): string {
    if (progress.phase === 'downloading-json') {
        return '正在获取模型信息';
    }
    if (progress.phase === 'downloading-zip') {
        const percentText = typeof progress.percent === 'number' ? ` ${Math.round(progress.percent * 100)}%` : '';
        return `正在下载模型${percentText}`;
    }
    if (progress.phase === 'verifying') {
        return '正在校验模型';
    }
    if (progress.phase === 'extracting') {
        return '正在解压模型';
    }
    return '正在应用模型';
}

function normalizeRecognitionMode(value: string | null | undefined): RecognitionMode | null {
    if (value === 'offline' || value === 'online') {
        return value;
    }
    return null;
}

export function useImportAudioSession({
    audioUri,
    audioName,
    noteInputRef,
    fromList = false,
    initialDisplayName,
    initialHeaderAtMs,
}: UseImportAudioSessionOptions) {
    const importDefaultDisplayName = React.useMemo(
        () => formatImportAudioDefaultName(initialHeaderAtMs ?? Date.now()),
        [initialHeaderAtMs],
    );
    const [displayName, setDisplayName] = React.useState(
        () => initialDisplayName?.trim() || (fromList ? resolveInitialDisplayName(audioName, initialHeaderAtMs) : importDefaultDisplayName),
    );
    const [editorTab, setEditorTab] = React.useState<EditorTabValue>('remark');
    const [headerAtMs, setHeaderAtMs] = React.useState(() => initialHeaderAtMs ?? Date.now());
    const [remarkText, setRemarkText] = React.useState('');
    const [transcriptText, setTranscriptText] = React.useState('');
    const [summaryText, setSummaryText] = React.useState('');
    const [noteEditorSeed, setNoteEditorSeed] = React.useState(0);
    const [resolvedAudioUri, setResolvedAudioUri] = React.useState<string | null>(null);
    const [isPlaybackMode, setIsPlaybackMode] = React.useState(false);
    const [playbackCompleted, setPlaybackCompleted] = React.useState(false);
    const [playbackRate, setPlaybackRate] = React.useState(1.0);
    const [seekPreviewPercent, setSeekPreviewPercent] = React.useState<number | null>(null);
    const [isSeeking, setIsSeeking] = React.useState(false);
    const [pendingSeekSec, setPendingSeekSec] = React.useState<number | null>(null);
    const [isPreparingSession, setIsPreparingSession] = React.useState(false);
    const [isInitialSessionLoading, setIsInitialSessionLoading] = React.useState(Boolean(audioUri));
    const [recognitionLanguage, setRecognitionLanguage] = React.useState<RecognitionLanguage>('zh');
    const [recognitionInstallState, setRecognitionInstallState] = React.useState<RecognitionInstallState>('ready');
    const [recognitionStatusText, setRecognitionStatusText] = React.useState('选择语言和识别方式');
    const [recognitionProgressPercent, setRecognitionProgressPercent] = React.useState<number | null>(null);
    const [isRecognizing, setIsRecognizing] = React.useState(false);
    const [recognitionState, setRecognitionState] = React.useState<RecognitionState>('idle');
    const [recentRecognitionMode, setRecentRecognitionMode] = React.useState<RecognitionMode | null>(null);
    const [confirmDialogState, setConfirmDialogState] = React.useState<ConfirmDialogState>({
        isVisible: false,
        title: '',
        description: '',
        confirmText: '确定',
        cancelText: '取消',
    });

    const seekThrottleLastMsRef = React.useRef(0);
    const seekThrottleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSeekResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isUnmountedRef = React.useRef(false);
    const seekPreviewPercentRef = React.useRef<number | null>(null);
    const saveInFlightRef = React.useRef(false);
    const saveLoadingToastIdRef = React.useRef<string | null>(null);
    const allowNextRemoveRef = React.useRef(false);
    const playbackBarVisible = useSharedValue(0);
    const pendingNavActionRef = React.useRef<unknown>(null);
    const sourceFileNameRef = React.useRef<string>('');
    const sourceFileNameNormalizedRef = React.useRef<string>('');
    const sourceFileSizeBytesRef = React.useRef<number | null>(null);
    const selectedSourceUriRef = React.useRef<string | null>(audioUri ?? null);
    const matchedRecordingRef = React.useRef<RecordingMeta | null>(null);
    const remarkDraftRef = React.useRef('');
    const recognitionRunIdRef = React.useRef(0);
    const recognitionStartTranscriptRef = React.useRef('');
    const initialSnapshotRef = React.useRef<SessionSnapshot>({
        displayName: initialDisplayName?.trim() || (fromList ? resolveInitialDisplayName(audioName, initialHeaderAtMs) : importDefaultDisplayName),
        noteRichText: '',
        transcriptText: '',
        summaryText: '',
    });

    const player = useAudioPlayer(null, { updateInterval: 200 });
    const playerStatus = useAudioPlayerStatus(player);
    const navigation = useNavigation();
    const { toast, loading, updateToast, dismiss } = useToast();
    const { show: showActionSheet, ActionSheet } = useActionSheet();
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

    const durationSec = Math.max(playerStatus.duration ?? 0, 0);
    const currentSec = Math.max(playerStatus.currentTime ?? 0, 0);
    const previewSec = seekPreviewPercent === null ? currentSec : (durationSec * seekPreviewPercent) / 100;
    const displayCurrentSec = isSeeking ? previewSec : currentSec;
    const displayProgressSec = isSeeking ? previewSec : (pendingSeekSec ?? currentSec);
    const progressPercent = durationSec > 0 ? Math.min(100, (displayProgressSec / durationSec) * 100) : 0;

    const getLatestRemarkText = useCallback(async () => {
        const input = noteInputRef?.current;
        if (input?.getHTML) {
            try {
                const html = await input.getHTML();
                if (typeof html === 'string') {
                    remarkDraftRef.current = html;
                    return html;
                }
            } catch (error) {
                console.warn('[import-audio] getHTML failed, fallback to draft ref', error);
            }
        }
        return remarkDraftRef.current;
    }, [noteInputRef]);

    const getCurrentSnapshot = useCallback(async (): Promise<SessionSnapshot> => {
        const latestRemarkText = await getLatestRemarkText();
        return {
            displayName,
            noteRichText: latestRemarkText,
            transcriptText,
            summaryText,
        };
    }, [displayName, getLatestRemarkText, summaryText, transcriptText]);

    const pausePlayerSafely = useCallback(async () => {
        try {
            await player.pause();
        } catch (error) {
            const message = (error as Error)?.message ?? String(error);
            if (message.includes('already released') || message.includes('cannot be cast')) {
                return;
            }
            console.warn('[import-audio-player] pause skipped:', message);
        }
    }, [player]);

    const safeSeekTo = useCallback(
        (seconds: number) => {
            if (isUnmountedRef.current) {
                return;
            }
            const clampedSeconds = Math.max(0, Math.min(durationSec || 0, seconds));
            const nowMs = Date.now();
            const throttleMs = 120;

            const executeSeek = () => {
                if (isUnmountedRef.current) {
                    return;
                }
                seekThrottleLastMsRef.current = Date.now();
                void player.seekTo(clampedSeconds);
            };

            if (nowMs - seekThrottleLastMsRef.current >= throttleMs) {
                executeSeek();
                return;
            }

            if (seekThrottleTimerRef.current) {
                clearTimeout(seekThrottleTimerRef.current);
            }
            seekThrottleTimerRef.current = setTimeout(executeSeek, throttleMs - (nowMs - seekThrottleLastMsRef.current));
        },
        [durationSec, player],
    );

    const startPlayback = useCallback(async () => {
        if (!resolvedAudioUri) {
            toast({
                title: '播放失败',
                description: '未获取到音频路径',
                variant: 'error',
            });
            return;
        }

        const playbackUri = ensureFileUri(resolvedAudioUri);
        try {
            const fileInfo = await FileSystem.getInfoAsync(playbackUri);
            if (!fileInfo.exists) {
                toast({
                    title: '播放失败',
                    description: '音频文件不存在',
                    variant: 'error',
                });
                return;
            }

            if (playbackCompleted) {
                await player.seekTo(0);
            }

            if (playerStatus.playing) {
                await pausePlayerSafely();
                return;
            }

            player.setPlaybackRate(playbackRate);
            player.play();
            setPlaybackCompleted(false);
            setIsPlaybackMode(true);
            setHeaderAtMs(Date.now());
        } catch (error) {
            toast({
                title: '播放失败',
                description: (error as Error).message ?? '音频无法播放',
                variant: 'error',
            });
        }
    }, [pausePlayerSafely, playbackCompleted, playbackRate, player, playerStatus.playing, resolvedAudioUri, toast]);

    const handleRewind = useCallback(() => {
        safeSeekTo(currentSec - 5);
    }, [currentSec, safeSeekTo]);

    const handleFastForward = useCallback(() => {
        safeSeekTo(currentSec + 5);
    }, [currentSec, safeSeekTo]);

    const handleOpenPlaybackRateSheet = useCallback(() => {
        showActionSheet({
            title: '选择倍速',
            options: PLAYBACK_SPEEDS.map(speed => ({
                title: `${Math.abs(playbackRate - speed) < 0.0001 ? '✓ ' : ''}${formatSpeed(speed)}x`,
                onPress: () => {
                    setPlaybackRate(speed);
                    player.setPlaybackRate(speed);
                },
            })),
            cancelButtonTitle: '取消',
        });
    }, [playbackRate, player, showActionSheet]);

    const handleStopPlayback = useCallback(async () => {
        await pausePlayerSafely();
        safeSeekTo(0);
        setIsPlaybackMode(false);
        setPlaybackCompleted(false);
        setIsSeeking(false);
        setSeekPreviewPercent(null);
        seekPreviewPercentRef.current = null;
        setPendingSeekSec(null);
    }, [pausePlayerSafely, safeSeekTo]);

    const onProgressValueChange = useCallback((value: number) => {
        seekPreviewPercentRef.current = value;
        setSeekPreviewPercent(value);
    }, []);

    const onSeekStart = useCallback(() => {
        setIsSeeking(true);
    }, []);

    const onSeekEnd = useCallback(() => {
        const finalPercent = seekPreviewPercentRef.current ?? progressPercent;
        const targetSec = durationSec > 0 ? (durationSec * finalPercent) / 100 : 0;
        setPendingSeekSec(targetSec);
        safeSeekTo(targetSec);
        if (pendingSeekResetTimerRef.current) {
            clearTimeout(pendingSeekResetTimerRef.current);
        }
        pendingSeekResetTimerRef.current = setTimeout(() => {
            setPendingSeekSec(null);
        }, 380);
        setIsSeeking(false);
        setSeekPreviewPercent(null);
        seekPreviewPercentRef.current = null;
    }, [durationSec, progressPercent, safeSeekTo]);

    const handleRemarkTextChange = useCallback((text: string) => {
        remarkDraftRef.current = text;
    }, []);

    const cancelRecognition = useCallback(async () => {
        recognitionRunIdRef.current += 1;
        setIsRecognizing(false);
        setRecognitionInstallState('ready');
        setRecognitionProgressPercent(null);
        setRecognitionState('stopped');
        setRecognitionStatusText('识别已终止');
        setTranscriptText(recognitionStartTranscriptRef.current);
        try {
            await SherpaOnnx.stopRealtimeAsr();
        } catch (error) {
            console.warn('[import-audio] stopRealtimeAsr skipped', error);
        }
    }, []);

    const runOfflineRecognition = useCallback(async () => {
        const sourceUri = selectedSourceUriRef.current;
        if (!sourceUri) {
            toast({
                title: '识别失败',
                description: '缺少音频路径',
                variant: 'error',
            });
            return;
        }
        if (recognitionState === 'preparing' || recognitionState === 'recognizing') {
            return;
        }

        const modelId = resolveOfflineModelId(recognitionLanguage);
        recognitionStartTranscriptRef.current = transcriptText;
        setRecentRecognitionMode('offline');
        const runId = recognitionRunIdRef.current + 1;
        recognitionRunIdRef.current = runId;
        setRecognitionState('preparing');
        setRecognitionInstallState('installing');
        setRecognitionStatusText('正在准备模型');
        setRecognitionProgressPercent(null);
        let installReady = false;

        try {
            await ensureModelReady(modelId, {
                baseUrl: MODEL_BASE_URL,
                onProgress: progress => {
                    if (recognitionRunIdRef.current !== runId) {
                        return;
                    }
                    setRecognitionStatusText(resolveInstallStatusText(progress));
                    if (progress.phase === 'downloading-zip' && typeof progress.percent === 'number') {
                        setRecognitionProgressPercent(Math.round(progress.percent * 100));
                    } else if (progress.phase === 'ready') {
                        setRecognitionProgressPercent(100);
                    }
                },
            });
            if (recognitionRunIdRef.current !== runId) {
                return;
            }

            setRecognitionInstallState('ready');
            installReady = true;
            setRecognitionProgressPercent(null);
            setRecognitionStatusText('正在语音识别');
            setRecognitionState('recognizing');
            setIsRecognizing(true);

            const { transcribe } = await transcribeFileWithTiming({
                filePath: sourceUri,
                modelId,
            });
            if (recognitionRunIdRef.current !== runId) {
                return;
            }

            setTranscriptText(transcribe.result.text || '');
            setRecognitionStatusText('识别完成');
            setRecognitionState('success');
        } catch (error) {
            if (recognitionRunIdRef.current !== runId) {
                return;
            }
            setTranscriptText(recognitionStartTranscriptRef.current);
            if (!installReady) {
                setRecognitionInstallState('failed');
                setRecognitionStatusText((error as Error)?.message ? `安装失败：${(error as Error).message}` : '安装失败');
            } else {
                setRecognitionInstallState('ready');
                setRecognitionStatusText((error as Error)?.message ? `识别失败：${(error as Error).message}` : '识别失败');
            }
            setRecognitionState('failed');
            toast({
                title: '离线识别失败',
                description: (error as Error)?.message ?? '请稍后重试',
                variant: 'error',
            });
        } finally {
            if (recognitionRunIdRef.current === runId) {
                setIsRecognizing(false);
            }
        }
    }, [recognitionLanguage, recognitionState, toast, transcriptText]);

    const runOnlineRecognition = useCallback(() => {
        setRecentRecognitionMode('online');
        setRecognitionStatusText('在线识别暂未接入');
        toast({
            title: '在线识别暂不可用',
            description: '请先使用离线识别',
            variant: 'error',
        });
    }, [toast]);

    const handleReRecognitionModeChange = useCallback(
        (value: string) => {
            if (value === 'online') {
                runOnlineRecognition();
                return;
            }
            void runOfflineRecognition();
        },
        [runOfflineRecognition, runOnlineRecognition],
    );

    const saveCurrentSession = useCallback(async (): Promise<boolean> => {
        if (saveInFlightRef.current) {
            return false;
        }
        if (isInitialSessionLoading || isPreparingSession) {
            return false;
        }
        const sourceUri = selectedSourceUriRef.current;
        if (!sourceUri) {
            toast({
                title: '保存失败',
                description: '缺少源音频路径',
                variant: 'error',
            });
            return false;
        }

        saveInFlightRef.current = true;
        const startedAt = Date.now();
        const loadingToastId = loading('正在保存内容');
        saveLoadingToastIdRef.current = loadingToastId;

        try {
            await pausePlayerSafely();
            const latestRemarkText = await getLatestRemarkText();
            let finalPath = matchedRecordingRef.current?.path || resolvedAudioUri || sourceUri;
            const sourceFileName = sourceFileNameRef.current || getSourceFileName(audioName, sourceUri);
            let sourceFileSizeBytes = sourceFileSizeBytesRef.current;
            if (sourceFileSizeBytes === null) {
                const sourceInfo = await FileSystem.getInfoAsync(ensureFileUri(sourceUri));
                if (sourceInfo.exists && typeof sourceInfo.size === 'number' && Number.isFinite(sourceInfo.size) && sourceInfo.size > 0) {
                    sourceFileSizeBytes = Math.floor(sourceInfo.size);
                    sourceFileSizeBytesRef.current = sourceFileSizeBytes;
                }
            }

            let shouldCopyFile = !matchedRecordingRef.current;
            if (matchedRecordingRef.current?.path) {
                const matchedUri = ensureFileUri(matchedRecordingRef.current.path);
                const matchedInfo = await FileSystem.getInfoAsync(matchedUri);
                if (!matchedInfo.exists) {
                    shouldCopyFile = true;
                }
            }

            if (shouldCopyFile) {
                if (!FileSystem.documentDirectory) {
                    throw new Error('文件系统目录不可用');
                }
                const importedDir = `${FileSystem.documentDirectory}recordings/imported/`;
                await FileSystem.makeDirectoryAsync(importedDir, { intermediates: true });
                const targetUri = createImportedFileUri(sourceFileName);
                updateToast(loadingToastId, { message: '正在读取文件' });
                await FileSystem.copyAsync({
                    from: ensureFileUri(sourceUri),
                    to: targetUri,
                });
                finalPath = targetUri;
            }

            updateToast(loadingToastId, { message: '正在写入数据' });
            const now = Date.now();
            const recordedAtMs = matchedRecordingRef.current?.recordedAtMs ?? now;
            await upsertRecordingMeta({
                path: finalPath,
                displayName: displayName.trim() || importDefaultDisplayName,
                sourceFileName,
                fileSizeBytes: sourceFileSizeBytes ?? null,
                noteRichText: latestRemarkText,
                transcriptText,
                summaryText,
                recentRecognitionMode,
                lastRecognitionAtMs: recentRecognitionMode ? Date.now() : matchedRecordingRef.current?.lastRecognitionAtMs ?? null,
                isFavorite: matchedRecordingRef.current?.isFavorite ?? false,
                sampleRate: matchedRecordingRef.current?.sampleRate ?? null,
                numSamples: matchedRecordingRef.current?.numSamples ?? null,
                durationMs: matchedRecordingRef.current?.durationMs ?? null,
                recordedAtMs,
                sessionId: matchedRecordingRef.current?.sessionId ?? null,
                reason: matchedRecordingRef.current?.reason ?? null,
            });

            const nextSnapshot: SessionSnapshot = {
                displayName: displayName.trim() || importDefaultDisplayName,
                noteRichText: latestRemarkText,
                transcriptText,
                summaryText,
            };
            initialSnapshotRef.current = nextSnapshot;
            remarkDraftRef.current = nextSnapshot.noteRichText;
            setDisplayName(nextSnapshot.displayName);
            setResolvedAudioUri(finalPath);
            matchedRecordingRef.current = {
                ...(matchedRecordingRef.current ?? {
                    sampleRate: null,
                    numSamples: null,
                    durationMs: null,
                    recordedAtMs,
                    sessionId: null,
                    reason: null,
                    isFavorite: false,
                    recentRecognitionMode: null,
                    lastRecognitionAtMs: null,
                }),
                path: finalPath,
                displayName: nextSnapshot.displayName,
                sourceFileName,
                fileSizeBytes: sourceFileSizeBytes ?? null,
                noteRichText: nextSnapshot.noteRichText,
                transcriptText: nextSnapshot.transcriptText,
                summaryText: nextSnapshot.summaryText,
                recordedAtMs,
                recentRecognitionMode,
                lastRecognitionAtMs: recentRecognitionMode ? Date.now() : matchedRecordingRef.current?.lastRecognitionAtMs ?? null,
            };

            return true;
        } catch (error) {
            toast({
                title: '保存失败',
                description: (error as Error)?.message ?? '请稍后重试',
                variant: 'error',
            });
            return false;
        } finally {
            const elapsedMs = Date.now() - startedAt;
            const remainingMs = Math.max(0, MIN_SAVE_OVERLAY_DURATION_MS - elapsedMs);
            if (remainingMs > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingMs));
            }
            dismiss(loadingToastId);
            if (saveLoadingToastIdRef.current === loadingToastId) {
                saveLoadingToastIdRef.current = null;
            }
            saveInFlightRef.current = false;
        }
    }, [
        audioName,
        displayName,
        dismiss,
        getLatestRemarkText,
        importDefaultDisplayName,
        loading,
        pausePlayerSafely,
        recentRecognitionMode,
        resolvedAudioUri,
        summaryText,
        toast,
        transcriptText,
        updateToast,
        isInitialSessionLoading,
        isPreparingSession,
    ]);

    const closeConfirmDialog = useCallback(() => {
        setConfirmDialogState(prev => ({ ...prev, isVisible: false }));
    }, []);

    const cancelConfirmDialog = useCallback(() => {
        confirmDialogState.onCancel?.();
        setConfirmDialogState(prev => ({ ...prev, isVisible: false }));
    }, [confirmDialogState.onCancel]);

    const requestLeaveWithConfirm = useCallback(
        async (pendingAction?: unknown) => {
            if (saveInFlightRef.current) {
                return;
            }
            if (isInitialSessionLoading || isPreparingSession) {
                resetDirtyBackGuard();
                allowNextRemoveRef.current = true;
                if (pendingAction) {
                    navigation.dispatch(pendingAction as never);
                } else {
                    navigation.goBack();
                }
                return;
            }
            if (recognitionState === 'preparing' || recognitionState === 'recognizing') {
                pendingNavActionRef.current = pendingAction ?? null;
                setConfirmDialogState({
                    isVisible: true,
                    title: '当前正在进行语音识别',
                    description: '返回操作将会打断识别进程',
                    confirmText: '确认退出',
                    cancelText: '取消',
                    confirmButtonProps: { variant: 'destructive' },
                    onConfirm: () => {
                        void (async () => {
                            await cancelRecognition();
                            const action = pendingNavActionRef.current;
                            pendingNavActionRef.current = null;
                            allowNextRemoveRef.current = true;
                            if (action) {
                                navigation.dispatch(action as never);
                            } else {
                                navigation.goBack();
                            }
                        })();
                    },
                    onCancel: () => {
                        pendingNavActionRef.current = null;
                    },
                });
                return;
            }
            const currentSnapshot = await getCurrentSnapshot();
            const isDirty = !isSameSnapshot(currentSnapshot, initialSnapshotRef.current);
            if (!isDirty) {
                resetDirtyBackGuard();
                allowNextRemoveRef.current = true;
                if (pendingAction) {
                    navigation.dispatch(pendingAction as never);
                } else {
                    navigation.goBack();
                }
                return;
            }

            const handledDirtyBack = await runDirtyBackAttempt({
                isDirty: true,
                onConfirmed: async () => {
                    pendingNavActionRef.current = pendingAction ?? null;
                    const ok = await saveCurrentSession();
                    if (!ok) {
                        pendingNavActionRef.current = null;
                        return;
                    }

                    const action = pendingNavActionRef.current;
                    pendingNavActionRef.current = null;
                    allowNextRemoveRef.current = true;
                    if (action) {
                        navigation.dispatch(action as never);
                    } else {
                        navigation.goBack();
                    }
                },
            });

            if (handledDirtyBack) {
                return;
            }
        },
        [
            cancelRecognition,
            getCurrentSnapshot,
            isInitialSessionLoading,
            isPreparingSession,
            navigation,
            recognitionState,
            resetDirtyBackGuard,
            runDirtyBackAttempt,
            saveCurrentSession,
        ],
    );

    const handleBackPress = useCallback(() => {
        void requestLeaveWithConfirm();
    }, [requestLeaveWithConfirm]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', event => {
            if (allowNextRemoveRef.current) {
                allowNextRemoveRef.current = false;
                return;
            }
            if (saveInFlightRef.current || isInitialSessionLoading || isPreparingSession) {
                return;
            }
            event.preventDefault();
            void requestLeaveWithConfirm(event.data.action);
        });
        return unsubscribe;
    }, [isInitialSessionLoading, isPreparingSession, navigation, requestLeaveWithConfirm]);

    useEffect(() => {
        let cancelled = false;
        setIsInitialSessionLoading(Boolean(audioUri));
        const run = async () => {
            if (!audioUri || cancelled) {
                setIsInitialSessionLoading(false);
                return;
            }
            if (fromList) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (cancelled) {
                    return;
                }
            }

            const rawSourceUri = audioUri;
            const sourceUri = ensureFileUri(rawSourceUri);
            selectedSourceUriRef.current = sourceUri;
            const sourceFileName = getSourceFileName(audioName, sourceUri);
            sourceFileNameRef.current = sourceFileName;
            sourceFileNameNormalizedRef.current = normalizeSourceFileName(sourceFileName);

            setIsPreparingSession(true);
            try {
                const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
                const sourceFileSizeBytes =
                    sourceInfo.exists && typeof sourceInfo.size === 'number' && Number.isFinite(sourceInfo.size) && sourceInfo.size > 0
                        ? Math.floor(sourceInfo.size)
                        : null;
                sourceFileSizeBytesRef.current = sourceFileSizeBytes;

                const matchedByPath = (await findRecordingMetaByPath(rawSourceUri)) ?? (await findRecordingMetaByPath(sourceUri));
                if (matchedByPath?.path) {
                    const matchedUri = ensureFileUri(matchedByPath.path);
                    const matchedInfo = await FileSystem.getInfoAsync(matchedUri);
                    if (matchedInfo.exists) {
                        matchedRecordingRef.current = matchedByPath;
                        sourceFileSizeBytesRef.current = matchedByPath.fileSizeBytes ?? sourceFileSizeBytesRef.current;
                        setResolvedAudioUri(matchedUri);
                        setDisplayName(
                            (matchedByPath.displayName?.trim() || initialDisplayName?.trim() || toDisplayName(sourceFileName)) ??
                                toDisplayName(sourceFileName),
                        );
                        setRemarkText(matchedByPath.noteRichText ?? '');
                        remarkDraftRef.current = matchedByPath.noteRichText ?? '';
                        setTranscriptText(matchedByPath.transcriptText ?? '');
                        setSummaryText(matchedByPath.summaryText ?? '');
                        setRecentRecognitionMode(normalizeRecognitionMode(matchedByPath.recentRecognitionMode));
                        setHeaderAtMs(matchedByPath.recordedAtMs ?? initialHeaderAtMs ?? Date.now());
                        initialSnapshotRef.current = {
                            displayName:
                                (matchedByPath.displayName?.trim() || initialDisplayName?.trim() || toDisplayName(sourceFileName)) ??
                                toDisplayName(sourceFileName),
                            noteRichText: matchedByPath.noteRichText ?? '',
                            transcriptText: matchedByPath.transcriptText ?? '',
                            summaryText: matchedByPath.summaryText ?? '',
                        };
                        setNoteEditorSeed(prev => prev + 1);
                        return;
                    }
                }

                if (!fromList && sourceFileSizeBytes !== null) {
                    const matched = await findRecordingMetaBySourceFileNameAndFileSize(
                        sourceFileNameNormalizedRef.current,
                        sourceFileSizeBytes,
                    );

                    if (matched?.path) {
                        const matchedUri = ensureFileUri(matched.path);
                        const matchedInfo = await FileSystem.getInfoAsync(matchedUri);
                        if (matchedInfo.exists) {
                            setConfirmDialogState({
                                isVisible: true,
                                title: '当前文件已存在',
                                description: '是否前往编辑页面',
                                confirmText: '前往编辑',
                                cancelText: '返回',
                                confirmButtonProps: { variant: 'primary' },
                                onConfirm: () => {
                                    router.replace({
                                        pathname: '/import-audio',
                                        params: { uri: matched.path, source: 'list' },
                                    });
                                },
                                onCancel: () => {
                                    allowNextRemoveRef.current = true;
                                    navigation.goBack();
                                },
                            });
                            return;
                        }
                    }
                }

                matchedRecordingRef.current = null;
                const fallbackDisplayName = initialDisplayName?.trim() || importDefaultDisplayName;
                setResolvedAudioUri(sourceUri);
                setDisplayName(fallbackDisplayName);
                setRemarkText('');
                remarkDraftRef.current = '';
                setTranscriptText('');
                setSummaryText('');
                setRecentRecognitionMode(null);
                setHeaderAtMs(initialHeaderAtMs ?? Date.now());
                initialSnapshotRef.current = {
                    displayName: fallbackDisplayName,
                    noteRichText: '',
                    transcriptText: '',
                    summaryText: '',
                };
                setNoteEditorSeed(prev => prev + 1);
            } catch (error) {
                console.warn('[import-audio] prepare session failed', error);
                matchedRecordingRef.current = null;
                sourceFileSizeBytesRef.current = null;
                const fallbackDisplayName = initialDisplayName?.trim() || importDefaultDisplayName;
                setResolvedAudioUri(sourceUri);
                setDisplayName(fallbackDisplayName);
                setRemarkText('');
                remarkDraftRef.current = '';
                setTranscriptText('');
                setSummaryText('');
                setRecentRecognitionMode(null);
                setHeaderAtMs(initialHeaderAtMs ?? Date.now());
                initialSnapshotRef.current = {
                    displayName: fallbackDisplayName,
                    noteRichText: '',
                    transcriptText: '',
                    summaryText: '',
                };
                setNoteEditorSeed(prev => prev + 1);
                toast({
                    title: '导入准备失败',
                    description: (error as Error)?.message ?? '请重新选择文件',
                    variant: 'error',
                });
            } finally {
                setIsPreparingSession(false);
                setIsInitialSessionLoading(false);
            }
        };
        void run();

        return () => {
            cancelled = true;
        };
    }, [audioName, audioUri, fromList, importDefaultDisplayName, initialDisplayName, initialHeaderAtMs, navigation, toast]);

    useEffect(() => {
        if (!resolvedAudioUri) {
            return;
        }
        player.replace(ensureFileUri(resolvedAudioUri));
    }, [player, resolvedAudioUri]);

    useEffect(() => {
        player.setPlaybackRate(playbackRate);
    }, [playbackRate, player]);

    useEffect(() => {
        if (playerStatus.didJustFinish && !playerStatus.playing) {
            setIsPlaybackMode(true);
            setPlaybackCompleted(true);
            setIsSeeking(false);
            setSeekPreviewPercent(null);
            seekPreviewPercentRef.current = null;
            setPendingSeekSec(null);
        }
    }, [playerStatus.didJustFinish, playerStatus.playing]);

    useEffect(() => {
        playbackBarVisible.value = withTiming(isPlaybackMode ? 1 : 0, { duration: 220 });
    }, [isPlaybackMode, playbackBarVisible]);

    useEffect(() => {
        return () => {
            recognitionRunIdRef.current += 1;
            isUnmountedRef.current = true;
            resetDirtyBackGuard();
            if (seekThrottleTimerRef.current) {
                clearTimeout(seekThrottleTimerRef.current);
            }
            if (pendingSeekResetTimerRef.current) {
                clearTimeout(pendingSeekResetTimerRef.current);
            }
            if (saveLoadingToastIdRef.current) {
                dismiss(saveLoadingToastIdRef.current);
                saveLoadingToastIdRef.current = null;
            }
            void pausePlayerSafely();
        };
    }, [dismiss, pausePlayerSafely, resetDirtyBackGuard]);

    const recognitionStatusIcon: RecognitionStatusIcon = React.useMemo(() => {
        if (recognitionInstallState === 'failed') {
            return 'warning-triangle';
        }
        if (recognitionInstallState === 'installing') {
            return 'arrow-down-circle';
        }
        return 'voice-scan';
    }, [recognitionInstallState]);
    const isRecognitionBusy = recognitionState === 'preparing' || recognitionState === 'recognizing';
    const recognitionPickerValue: RecognitionMode = recentRecognitionMode ?? 'offline';
    const recentRecognitionLabel = recentRecognitionMode === 'online' ? '**在线识别**' : '**离线识别**';
    const reRecognitionOptions = React.useMemo(
        () => [
            {
                label: '离线识别',
                value: 'offline',
                description: `最近一次使用：${recentRecognitionLabel}`,
            },
            {
                label: '在线识别',
                value: 'online',
                description: `最近一次使用：${recentRecognitionLabel}`,
            },
        ],
        [recentRecognitionLabel],
    );

    const speedLabel = formatSpeed(playbackRate);

    const playbackBarAnimatedStyle = useAnimatedStyle(() => {
        return {
            opacity: playbackBarVisible.value,
            maxHeight: interpolate(playbackBarVisible.value, [0, 1], [0, 40]),
            transform: [{ translateY: interpolate(playbackBarVisible.value, [0, 1], [18, 0]) }],
            marginTop: interpolate(playbackBarVisible.value, [0, 1], [0, 4]),
        };
    });

    const toolbarAnimatedStyle = useAnimatedStyle(() => {
        return {
            paddingBottom: interpolate(playbackBarVisible.value, [0, 1], [16, 10]),
        };
    });

    const toolbarMainRowAnimatedStyle = useAnimatedStyle(() => {
        return {
            marginBottom: interpolate(playbackBarVisible.value, [0, 1], [0, 12]),
        };
    });

    return {
        displayName,
        setDisplayName,
        editorTab,
        setEditorTab,
        headerAtMs,
        remarkText,
        handleRemarkTextChange,
        transcriptText,
        setTranscriptText,
        summaryText,
        setSummaryText,
        noteEditorSeed,
        isPlaybackMode,
        playbackCompleted,
        playbackRate,
        speedLabel,
        isPlaying: playerStatus.playing,
        durationSec,
        displayCurrentSec,
        progressPercent,
        startPlayback,
        handleRewind,
        handleFastForward,
        handleOpenPlaybackRateSheet,
        handleStopPlayback,
        onProgressValueChange,
        onSeekStart,
        onSeekEnd,
        playbackBarAnimatedStyle,
        toolbarAnimatedStyle,
        toolbarMainRowAnimatedStyle,
        ActionSheet,
        handleBackPress,
        confirmDialogState,
        closeConfirmDialog,
        cancelConfirmDialog,
        isPreparingSession,
        isInitialSessionLoading,
        recognitionLanguage,
        setRecognitionLanguage,
        recognitionState,
        recognitionStatusIcon,
        recognitionStatusText,
        recognitionProgressPercent,
        isRecognizing,
        isRecognitionBusy,
        recognitionPickerValue,
        reRecognitionOptions,
        cancelRecognition,
        handleReRecognitionModeChange,
        runOfflineRecognition,
        runOnlineRecognition,
    };
}
