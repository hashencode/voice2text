import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import type { EnrichedTextInputInstance } from 'react-native-enriched';
import { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useActionSheet } from '~/components/ui/action-sheet';
import { useToast } from '~/components/ui/toast';
import { findRecordingMetaBySourceFileNameAndSha256, upsertRecordingMeta, type RecordingMeta } from '~/data/sqlite/services/recordings.service';
import { formatSpeed, toDisplayName } from '~/features/session-editor/services/time-format';
import type { EditorTabValue } from '~/features/session-editor/types';
import SherpaOnnx from '~/modules/sherpa';

const PLAYBACK_SPEEDS = [2.0, 1.5, 1.0, 0.9] as const;
const MIN_SAVE_OVERLAY_DURATION_MS = 2000;

type UseImportAudioSessionOptions = {
    audioUri?: string;
    audioName?: string | string[];
    noteInputRef?: React.RefObject<EnrichedTextInputInstance | null>;
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

function toHashPath(path: string): string {
    if (!path) {
        return path;
    }
    return path.replace(/^file:\/\//, '');
}

function normalizeSourceFileName(name: string): string {
    return name.trim().toLowerCase();
}

function getFileNameFromUri(uri: string): string {
    const cleanUri = uri.split('?')[0];
    const segments = cleanUri.split('/');
    return decodeURIComponent(segments[segments.length - 1] || 'import-audio');
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
    return 'import-audio';
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
    return Array.isArray(name) ? name[0] ?? '' : name ?? '';
}

function isSameSnapshot(a: SessionSnapshot, b: SessionSnapshot): boolean {
    return (
        a.displayName === b.displayName &&
        a.noteRichText === b.noteRichText &&
        a.transcriptText === b.transcriptText &&
        a.summaryText === b.summaryText
    );
}

export function useImportAudioSession({ audioUri, audioName, noteInputRef }: UseImportAudioSessionOptions) {
    const [displayName, setDisplayName] = React.useState(() => toDisplayName(audioName));
    const [editorTab, setEditorTab] = React.useState<EditorTabValue>('remark');
    const [headerAtMs, setHeaderAtMs] = React.useState(() => Date.now());
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
    const [saveOverlayVisible, setSaveOverlayVisible] = React.useState(false);
    const [saveOverlayLabel, setSaveOverlayLabel] = React.useState('正在保存内容...');
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
    const allowNextRemoveRef = React.useRef(false);
    const playbackBarVisible = useSharedValue(0);
    const pendingNavActionRef = React.useRef<unknown>(null);
    const sourceFileNameRef = React.useRef<string>('');
    const sourceFileNameNormalizedRef = React.useRef<string>('');
    const sourceSha256Ref = React.useRef<string | null>(null);
    const selectedSourceUriRef = React.useRef<string | null>(audioUri ?? null);
    const matchedRecordingRef = React.useRef<RecordingMeta | null>(null);
    const remarkDraftRef = React.useRef('');
    const initialSnapshotRef = React.useRef<SessionSnapshot>({
        displayName: toDisplayName(audioName),
        noteRichText: '',
        transcriptText: '',
        summaryText: '',
    });

    const player = useAudioPlayer(null, { updateInterval: 200 });
    const playerStatus = useAudioPlayerStatus(player);
    const navigation = useNavigation();
    const { toast } = useToast();
    const { show: showActionSheet, ActionSheet } = useActionSheet();

    const durationSec = Math.max(playerStatus.duration ?? 0, 0);
    const currentSec = Math.max(playerStatus.currentTime ?? 0, 0);
    const previewSec = seekPreviewPercent === null ? currentSec : (durationSec * seekPreviewPercent) / 100;
    const displayCurrentSec = isSeeking ? previewSec : currentSec;
    const displayProgressSec = isSeeking ? previewSec : pendingSeekSec ?? currentSec;
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
                duration: 2500,
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
                    duration: 2500,
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
                duration: 2500,
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

    const saveCurrentSession = useCallback(async (): Promise<boolean> => {
        if (saveInFlightRef.current) {
            return false;
        }
        const sourceUri = selectedSourceUriRef.current;
        if (!sourceUri) {
            toast({
                title: '保存失败',
                description: '缺少源音频路径',
                variant: 'error',
                duration: 2500,
            });
            return false;
        }

        saveInFlightRef.current = true;
        const startedAt = Date.now();
        setSaveOverlayVisible(true);
        setSaveOverlayLabel('正在保存内容...');

        try {
            const latestRemarkText = await getLatestRemarkText();
            let finalPath = matchedRecordingRef.current?.path || resolvedAudioUri || sourceUri;
            const sourceFileName = sourceFileNameRef.current || getSourceFileName(audioName, sourceUri);
            const sourceSha256 = sourceSha256Ref.current;

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
                setSaveOverlayLabel('正在保存文件...');
                await FileSystem.copyAsync({
                    from: ensureFileUri(sourceUri),
                    to: targetUri,
                });
                finalPath = targetUri;
            }

            setSaveOverlayLabel('正在写入数据...');
            const now = Date.now();
            const recordedAtMs = matchedRecordingRef.current?.recordedAtMs ?? now;
            await upsertRecordingMeta({
                path: finalPath,
                displayName: displayName.trim() || toDisplayName(sourceFileName),
                sourceFileName,
                sha256: sourceSha256 ?? null,
                noteRichText: latestRemarkText,
                transcriptText,
                summaryText,
                isFavorite: matchedRecordingRef.current?.isFavorite ?? false,
                sampleRate: matchedRecordingRef.current?.sampleRate ?? null,
                numSamples: matchedRecordingRef.current?.numSamples ?? null,
                durationMs: matchedRecordingRef.current?.durationMs ?? null,
                recordedAtMs,
                sessionId: matchedRecordingRef.current?.sessionId ?? null,
                reason: matchedRecordingRef.current?.reason ?? null,
            });

            const nextSnapshot: SessionSnapshot = {
                displayName: displayName.trim() || toDisplayName(sourceFileName),
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
                }),
                path: finalPath,
                displayName: nextSnapshot.displayName,
                sourceFileName,
                sha256: sourceSha256 ?? null,
                noteRichText: nextSnapshot.noteRichText,
                transcriptText: nextSnapshot.transcriptText,
                summaryText: nextSnapshot.summaryText,
                recordedAtMs,
            };

            return true;
        } catch (error) {
            toast({
                title: '保存失败',
                description: (error as Error)?.message ?? '请稍后重试',
                variant: 'error',
                duration: 3000,
            });
            return false;
        } finally {
            const elapsedMs = Date.now() - startedAt;
            const remainingMs = Math.max(0, MIN_SAVE_OVERLAY_DURATION_MS - elapsedMs);
            if (remainingMs > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingMs));
            }
            setSaveOverlayVisible(false);
            saveInFlightRef.current = false;
        }
    }, [audioName, displayName, getLatestRemarkText, resolvedAudioUri, summaryText, toast, transcriptText]);

    const closeConfirmDialog = useCallback(() => {
        setConfirmDialogState(prev => ({ ...prev, isVisible: false }));
    }, []);

    const cancelConfirmDialog = useCallback(() => {
        confirmDialogState.onCancel?.();
        setConfirmDialogState(prev => ({ ...prev, isVisible: false }));
    }, [confirmDialogState.onCancel]);

    const requestLeaveWithConfirm = useCallback(
        async (pendingAction?: unknown) => {
            if (saveInFlightRef.current || isPreparingSession) {
                return;
            }
            const currentSnapshot = await getCurrentSnapshot();
            const isDirty = !isSameSnapshot(currentSnapshot, initialSnapshotRef.current);
            if (!isDirty) {
                allowNextRemoveRef.current = true;
                if (pendingAction) {
                    navigation.dispatch(pendingAction as never);
                } else {
                    navigation.goBack();
                }
                return;
            }

            pendingNavActionRef.current = pendingAction ?? null;
            setConfirmDialogState({
                isVisible: true,
                title: '保存内容修改',
                description: '离开前是否保存当前修改？',
                confirmText: '保存修改',
                cancelText: '放弃修改',
                confirmButtonProps: { variant: 'primary' },
                onConfirm: () => {
                    void (async () => {
                        const ok = await saveCurrentSession();
                        if (!ok) {
                            return;
                        }
                        setConfirmDialogState({
                            isVisible: true,
                            title: '保存成功',
                            description: '内容已保存，是否返回上一页？',
                            confirmText: '返回',
                            cancelText: '继续编辑',
                            confirmButtonProps: { variant: 'primary' },
                            onConfirm: () => {
                                const action = pendingNavActionRef.current;
                                pendingNavActionRef.current = null;
                                allowNextRemoveRef.current = true;
                                if (action) {
                                    navigation.dispatch(action as never);
                                } else {
                                    navigation.goBack();
                                }
                            },
                            onCancel: () => {
                                pendingNavActionRef.current = null;
                            },
                        });
                    })();
                },
                onCancel: () => {
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
        },
        [getCurrentSnapshot, isPreparingSession, navigation, saveCurrentSession],
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
            if (saveInFlightRef.current || isPreparingSession) {
                return;
            }
            event.preventDefault();
            void requestLeaveWithConfirm(event.data.action);
        });
        return unsubscribe;
    }, [isPreparingSession, navigation, requestLeaveWithConfirm]);

    useEffect(() => {
        const run = async () => {
            if (!audioUri) {
                return;
            }

            const sourceUri = ensureFileUri(audioUri);
            selectedSourceUriRef.current = sourceUri;
            const sourceFileName = getSourceFileName(audioName, sourceUri);
            sourceFileNameRef.current = sourceFileName;
            sourceFileNameNormalizedRef.current = normalizeSourceFileName(sourceFileName);

            setIsPreparingSession(true);
            try {
                const digest = await SherpaOnnx.getFileSha256(toHashPath(sourceUri));
                const sourceSha256 = digest.sha256.trim().toLowerCase();
                sourceSha256Ref.current = sourceSha256;
                const matched = await findRecordingMetaBySourceFileNameAndSha256(sourceFileNameNormalizedRef.current, sourceSha256);

                if (matched?.path) {
                    const matchedUri = ensureFileUri(matched.path);
                    const matchedInfo = await FileSystem.getInfoAsync(matchedUri);
                    if (matchedInfo.exists) {
                        matchedRecordingRef.current = matched;
                        setResolvedAudioUri(matchedUri);
                        setDisplayName((matched.displayName?.trim() || toDisplayName(sourceFileName)) ?? toDisplayName(sourceFileName));
                        setRemarkText(matched.noteRichText ?? '');
                        remarkDraftRef.current = matched.noteRichText ?? '';
                        setTranscriptText(matched.transcriptText ?? '');
                        setSummaryText(matched.summaryText ?? '');
                        setHeaderAtMs(matched.recordedAtMs ?? Date.now());
                        initialSnapshotRef.current = {
                            displayName: (matched.displayName?.trim() || toDisplayName(sourceFileName)) ?? toDisplayName(sourceFileName),
                            noteRichText: matched.noteRichText ?? '',
                            transcriptText: matched.transcriptText ?? '',
                            summaryText: matched.summaryText ?? '',
                        };
                        setNoteEditorSeed(prev => prev + 1);
                        return;
                    }
                }

                matchedRecordingRef.current = null;
                const fallbackDisplayName = toDisplayName(toSingleName(audioName) || sourceFileName);
                setResolvedAudioUri(sourceUri);
                setDisplayName(fallbackDisplayName);
                setRemarkText('');
                remarkDraftRef.current = '';
                setTranscriptText('');
                setSummaryText('');
                setHeaderAtMs(Date.now());
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
                sourceSha256Ref.current = null;
                const fallbackDisplayName = toDisplayName(toSingleName(audioName) || sourceFileNameRef.current || sourceUri);
                setResolvedAudioUri(sourceUri);
                setDisplayName(fallbackDisplayName);
                setRemarkText('');
                remarkDraftRef.current = '';
                setTranscriptText('');
                setSummaryText('');
                setHeaderAtMs(Date.now());
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
                    duration: 3000,
                });
            } finally {
                setIsPreparingSession(false);
            }
        };
        void run();
    }, [audioName, audioUri, toast]);

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
            isUnmountedRef.current = true;
            if (seekThrottleTimerRef.current) {
                clearTimeout(seekThrottleTimerRef.current);
            }
            if (pendingSeekResetTimerRef.current) {
                clearTimeout(pendingSeekResetTimerRef.current);
            }
            void pausePlayerSafely();
        };
    }, [pausePlayerSafely]);

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
        saveOverlayVisible,
        saveOverlayLabel,
        isPreparingSession,
    };
}
