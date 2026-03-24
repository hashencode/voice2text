import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import { Mic, Pause, Play, Square } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DefaultLayout } from '~/components/layout/DefaultLayout';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { AudioWaveform } from '~/components/ui/audio-waveform';
import { TextX } from '~/components/ui/textx';
import { upsertRecordingMeta } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { useWavRecording } from '~/hooks/useWavRecording';
import { Colors } from '~/theme/colors';

function getRecordingsDir(): string {
    if (!FileSystem.documentDirectory) {
        throw new Error('文件系统目录不可用');
    }
    return `${FileSystem.documentDirectory}recordings/`;
}

function createRecordingPath(): string {
    const fileName = `record-${Date.now()}.wav`;
    return `${getRecordingsDir()}${fileName}`;
}

export default function RecordPage() {
    const [waveformData, setWaveformData] = useState<number[]>(() => Array.from({ length: 34 }, () => 0.15));
    const iconColor = useColor('card');
    const primaryColor = useColor('primary');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const destructiveColor = useColor('destructive');
    const cardColor = useColor('card');
    const bgColor = useColor('background');
    const pausePlayBgColor = useColor('background', { light: bgColor, dark: Colors.light.background });
    const micIconColor = useColor('primaryForeground', { light: iconColor, dark: Colors.dark.text });
    const playPauseIconColor = useColor('text', { light: textColor, dark: Colors.light.text });
    const stopIconColor = useColor('destructiveForeground', { light: cardColor, dark: Colors.dark.text });

    const { phase, isPaused, actionLoading, elapsedText, startRecord, pauseRecord, resumeRecord, stopRecord } = useWavRecording({
        sampleRate: 16000,
        createTargetPath: async () => {
            const directory = getRecordingsDir();
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            return createRecordingPath();
        },
        onStart: () => {

        },
        onStop: async wavResult => {
            if (!wavResult.path) {
                return;
            }

            const durationMs = wavResult.sampleRate > 0 ? Math.round((wavResult.numSamples / wavResult.sampleRate) * 1000) : null;
            const sessionId = wavResult.sessionId?.trim() || undefined;

            try {
                await upsertRecordingMeta({
                    path: wavResult.path,
                    sampleRate: wavResult.sampleRate,
                    numSamples: wavResult.numSamples,
                    durationMs,
                    recordedAtMs: Date.now(),
                    sessionId,
                });
            } catch (error) {
                console.error('[record] upsertRecordingMeta failed', error);
            }
        },
        onPermissionDenied: () => {

        },
        onError: error => {

        },
    });

    const isRecordingOrPaused = phase === 'recording' || phase === 'paused' || phase === 'stopping';
    const isStopping = phase === 'stopping';
    const canStop = phase === 'recording' || phase === 'paused';
    const isIdleLike = phase === 'idle' || phase === 'error';
    const isMicVisualState = isIdleLike || isStopping;

    const handleLeftAction = () => {
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
    };

    const handleConfirmStop = () => {
        if (!canStop || isStopping) {
            return;
        }
        Alert.alert('结束录音', '确认结束并保存当前录音吗？', [
            { text: '取消', style: 'cancel' },
            {
                text: '结束',
                style: 'destructive',
                onPress: () => {
                    stopRecord();
                },
            },
        ]);
    };

    const LeftIcon = isMicVisualState ? Mic : isPaused ? Play : Pause;
    const leftIconColor = isMicVisualState ? micIconColor : playPauseIconColor;

    useEffect(() => {
        if (phase !== 'recording') {
            setWaveformData(Array.from({ length: 34 }, () => 0.15));
            return;
        }

        const timer = setInterval(() => {
            setWaveformData(prev => {
                const t = Date.now() / 250;
                const base = 0.38 + Math.sin(t) * 0.15;
                const noise = (Math.random() - 0.5) * 0.3;
                const peak = Math.random() < 0.12 ? Math.random() * 0.35 : 0;
                const nextLevel = Math.max(0.1, Math.min(0.95, base + noise + peak));
                return [...prev.slice(1), nextLevel];
            });
        }, 90);

        return () => {
            clearInterval(timer);
        };
    }, [phase]);

    return (
        <DefaultLayout headTitle="录音" safeAreaViewConfig={{ edges: ['top', 'left', 'right', 'bottom'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex flex-1">
                <View className="flex-grow items-center justify-center">
                    <TextX style={{ fontSize: 64, lineHeight: 72, fontVariant: ['tabular-nums'] }}>{elapsedText}</TextX>
                </View>

                <View className="flex-shrink-0 px-6 py-3">
                    <View className="flex-row items-center gap-3 rounded-full p-2 shadow" style={{ backgroundColor: cardColor }}>
                        <BouncyPressable onPress={handleLeftAction} disabled={actionLoading || isStopping} scaleIn={1.08}>
                            <Animated.View
                                className="items-center justify-center rounded-full"
                                style={{ width: 48, height: 48, backgroundColor: isMicVisualState ? primaryColor : pausePlayBgColor, opacity: isStopping ? 0.5 : 1 }}>
                                <LeftIcon size={22} color={leftIconColor} />
                            </Animated.View>
                        </BouncyPressable>

                        <View className="flex-1 items-center justify-center">
                            {isRecordingOrPaused ? (
                                <AudioWaveform
                                    data={waveformData}
                                    isPlaying={phase === 'recording' && !isPaused}
                                    animated
                                    interactive={false}
                                    showProgress={false}
                                    barCount={34}
                                    barWidth={3}
                                    barGap={2}
                                    height={38}
                                    activeColor={destructiveColor}
                                    inactiveColor={mutedTextColor}
                                />
                            ) : (
                                <TextX variant="description" style={{ color: mutedTextColor }}>
                                    点击左侧开始录音
                                </TextX>
                            )}
                        </View>

                        {canStop ? (
                            <Pressable onPress={handleConfirmStop} disabled={isStopping}>
                                <View
                                    className="items-center justify-center rounded-full"
                                    style={{ width: 48, height: 48, backgroundColor: destructiveColor, opacity: isStopping ? 0.35 : 1 }}>
                                    <Square size={20} color={stopIconColor} />
                                </View>
                            </Pressable>
                        ) : (
                            <View style={{ width: 48, height: 48 }} />
                        )}
                    </View>
                </View>
            </View>
        </DefaultLayout>
    );
}
