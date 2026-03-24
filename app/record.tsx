import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import { Mic, Pause, Play, Square } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultLayout } from '~/components/layout/DefaultLayout';
import { AudioWaveform } from '~/components/ui/audio-waveform';
import { TextX } from '~/components/ui/textx';
import { upsertRecordingMeta } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { useWavRecording } from '~/hooks/useWavRecording';

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
                    {isRecordingOrPaused ? (
                        <View className="flex-row items-center gap-3 rounded-full p-2 shadow" style={{ backgroundColor: cardColor }}>
                            <Pressable onPress={isPaused ? resumeRecord : pauseRecord} disabled={actionLoading || isStopping}>
                                <View
                                    className="items-center justify-center rounded-full"
                                    style={{ width: 48, height: 48, backgroundColor: bgColor, opacity: isStopping ? 0.5 : 1 }}>
                                    {isPaused ? <Play size={22} color={textColor} /> : <Pause size={22} color={textColor} />}
                                </View>
                            </Pressable>

                            <View className="flex-1 items-center justify-center">
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
                            </View>

                            <Pressable onPress={stopRecord} disabled={isStopping}>
                                <View
                                    className="items-center justify-center rounded-full"
                                    style={{ width: 48, height: 48, backgroundColor: destructiveColor, opacity: isStopping ? 0.5 : 1 }}>
                                    <Square size={20} color={cardColor} />
                                </View>
                            </Pressable>
                        </View>
                    ) : (
                        <View className="flex flex-row justify-center">
                            <Pressable
                                className="flex items-center justify-center rounded-full"
                                style={{ width: 80, height: 80, backgroundColor: primaryColor }}
                                onPress={startRecord}
                                disabled={actionLoading}>
                                <Mic size={50} color={iconColor} />
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>
        </DefaultLayout>
    );
}
