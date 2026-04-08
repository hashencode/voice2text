import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useActionSheet } from '~/components/ui/action-sheet';
import { useToast } from '~/components/ui/toast';
import { formatSpeed, toDisplayName } from '~/features/session-editor/services/time-format';
import type { EditorTabValue } from '~/features/session-editor/types';

const PLAYBACK_SPEEDS = [2.0, 1.5, 1.0, 0.9] as const;

type UseImportAudioSessionOptions = {
    audioUri?: string;
    audioName?: string | string[];
};

export function useImportAudioSession({ audioUri, audioName }: UseImportAudioSessionOptions) {
    const [displayName, setDisplayName] = React.useState(() => toDisplayName(audioName));
    const [editorTab, setEditorTab] = React.useState<EditorTabValue>('remark');
    const [headerAtMs, setHeaderAtMs] = React.useState(() => Date.now());
    const [isPlaybackMode, setIsPlaybackMode] = React.useState(false);
    const [playbackCompleted, setPlaybackCompleted] = React.useState(false);
    const [playbackRate, setPlaybackRate] = React.useState(1.0);
    const [seekPreviewPercent, setSeekPreviewPercent] = React.useState<number | null>(null);
    const [isSeeking, setIsSeeking] = React.useState(false);
    const [pendingSeekSec, setPendingSeekSec] = React.useState<number | null>(null);
    const seekThrottleLastMsRef = React.useRef(0);
    const seekThrottleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSeekResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isUnmountedRef = React.useRef(false);
    const seekPreviewPercentRef = React.useRef<number | null>(null);
    const playbackBarVisible = useSharedValue(0);

    const player = useAudioPlayer(null, { updateInterval: 200 });
    const playerStatus = useAudioPlayerStatus(player);
    const navigation = useNavigation();
    const { toast } = useToast();
    const { show: showActionSheet, ActionSheet } = useActionSheet();

    const durationSec = Math.max(playerStatus.duration ?? 0, 0);
    const currentSec = Math.max(playerStatus.currentTime ?? 0, 0);
    const previewSec = seekPreviewPercent === null ? currentSec : (durationSec * seekPreviewPercent) / 100;
    const displayCurrentSec = isSeeking ? previewSec : currentSec;
    const displayProgressSec = isSeeking ? previewSec : (pendingSeekSec ?? currentSec);
    const progressPercent = durationSec > 0 ? Math.min(100, (displayProgressSec / durationSec) * 100) : 0;

    const pausePlayerSafely = useCallback(async () => {
        try {
            await player.pause();
        } catch (error) {
            console.warn('[import-audio-player] pause skipped:', (error as Error)?.message ?? error);
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
        if (!audioUri) {
            toast({
                title: '播放失败',
                description: '未获取到音频路径',
                variant: 'error',
                duration: 2500,
            });
            return;
        }

        try {
            const fileInfo = await FileSystem.getInfoAsync(audioUri);
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
    }, [audioUri, pausePlayerSafely, playbackCompleted, playbackRate, player, playerStatus.playing, toast]);

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

    useEffect(() => {
        if (!audioUri) {
            return;
        }
        player.replace(audioUri);
    }, [audioUri, player]);

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

    const handleBackPress = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    return {
        displayName,
        setDisplayName,
        editorTab,
        setEditorTab,
        headerAtMs,
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
        onProgressValueChange,
        onSeekStart,
        onSeekEnd,
        playbackBarAnimatedStyle,
        toolbarAnimatedStyle,
        toolbarMainRowAnimatedStyle,
        ActionSheet,
        handleBackPress,
    };
}
