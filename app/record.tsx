import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import { Mic, Pause, Play, Square } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/DefaultLayout';
import { AudioWaveform } from '~/components/ui/audio-waveform';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
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
    const [waveformData, setWaveformData] = useState<number[]>(() => Array.from({ length: 52 }, () => 0.15));
    const { toast } = useToast();
    const primaryColor = useColor('primary');
    const mutedTextColor = useColor('textMuted');
    const destructiveColor = useColor('destructive');
    const cardColor = useColor('card');

    const showRecordError = (description: string) => {
        toast({
            title: '录音失败',
            description,
            variant: 'error',
            duration: 8000,
        });
    };

    const { phase, isPaused, actionLoading, elapsedText, startRecord, pauseRecord, resumeRecord, stopRecord } = useWavRecording({
        sampleRate: 16000,
        createTargetPath: async () => {
            const directory = getRecordingsDir();
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            return createRecordingPath();
        },
        onStart: () => {},
        onStop: async wavResult => {
            if (!wavResult.path) {
                showRecordError('未能获取录音文件，请重试');
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

                toast({
                    title: '录音已保存',
                    variant: 'success',
                    duration: 3000,
                });
            } catch (error) {
                console.error('[record] upsertRecordingMeta failed', error);
                showRecordError('录音已生成，但保存元数据失败');
            }
        },
        onPermissionDenied: () => {
            showRecordError('麦克风权限被拒绝');
        },
        onError: error => {
            console.error('[record] recording error', error);
            showRecordError(error.message || '录音过程中发生错误');
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

    useEffect(() => {
        if (phase !== 'recording') {
            setWaveformData(Array.from({ length: 52 }, () => 0.15));
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
                    <TextX style={{ fontSize: 56, lineHeight: 60, includeFontPadding: false, fontVariant: ['tabular-nums'] }}>{elapsedText}</TextX>
                </View>

                <View className="flex-shrink-0 p-4">
                    <View className="flex-row items-center gap-3 rounded-full p-2 shadow" style={{ backgroundColor: cardColor }}>
                        <BouncyPressable onPress={handleLeftAction} disabled={actionLoading || isStopping} scaleIn={1.08}>
                            <View
                                className="items-center justify-center rounded-full"
                                style={{
                                    width: 48,
                                    height: 48,
                                    backgroundColor: isMicVisualState ? primaryColor : Colors.light.background,
                                    opacity: isStopping ? 0.5 : 1,
                                }}>
                                <LeftIcon size={22} color={isMicVisualState ? Colors.light.card : Colors.light.text} />
                            </View>
                        </BouncyPressable>

                        <View className="flex-1 items-center justify-center">
                            {isRecordingOrPaused ? (
                                <AudioWaveform
                                    data={waveformData}
                                    isPlaying={phase === 'recording' && !isPaused}
                                    animated
                                    interactive={false}
                                    showProgress={false}
                                    height={34}
                                    activeColor={destructiveColor}
                                    inactiveColor={mutedTextColor}
                                />
                            ) : (
                                <TextX style={{ color: mutedTextColor }}>点击左侧开始录音</TextX>
                            )}
                        </View>

                        {canStop ? (
                            <Pressable onPress={handleConfirmStop} disabled={isStopping}>
                                <View
                                    className="items-center justify-center rounded-full"
                                    style={{ width: 48, height: 48, backgroundColor: destructiveColor, opacity: isStopping ? 0.5 : 1 }}>
                                    <Square size={20} color={Colors.light.card} />
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
