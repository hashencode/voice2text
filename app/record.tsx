import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/DefaultLayout';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { upsertRecordingMeta } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { useWavRecording } from '~/hooks/useWavRecording';
import { Mic, Pause, Play, Square } from 'lucide-react-native';

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
    const [recordingStatusText, setRecordingStatusText] = useState('未开始录音');
    const [latestPath, setLatestPath] = useState<string | null>(null);
    const iconColor = useColor('card');
    const primaryColor = useColor('primary');
    const mutedTextColor = useColor('textMuted');

    const { phase, isPaused, actionLoading, elapsedText, startRecord, pauseRecord, resumeRecord, stopRecord } = useWavRecording({
        sampleRate: 16000,
        createTargetPath: async () => {
            const directory = getRecordingsDir();
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            return createRecordingPath();
        },
        onStart: () => {
            setRecordingStatusText('录音中，再次点击停止并保存');
        },
        onStop: async wavResult => {
            if (!wavResult.path) {
                setRecordingStatusText('停止录音失败，未拿到音频文件');
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
                setLatestPath(wavResult.path);
                setRecordingStatusText('录音完成，音频已保存并入库');
            } catch (error) {
                console.error('[record] upsertRecordingMeta failed', error);
                setRecordingStatusText('录音已保存，但入库失败');
            }
        },
        onPermissionDenied: () => {
            setRecordingStatusText('未获得麦克风权限');
        },
        onError: error => {
            setRecordingStatusText(`录音/保存失败: ${error.message}`);
        },
    });

    const isRecordingOrPaused = phase === 'recording' || phase === 'paused' || phase === 'stopping';

    return (
        <DefaultLayout headTitle="录音" safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-1 items-center justify-center gap-6 px-6">
                {!isRecordingOrPaused ? (
                    <Pressable
                        className="items-center justify-center rounded-full"
                        style={{ width: 148, height: 148, backgroundColor: primaryColor }}
                        onPress={startRecord}
                        disabled={actionLoading}>
                        <Mic size={56} color={iconColor} />
                    </Pressable>
                ) : (
                    <View className="items-center gap-8">
                        <TextX style={{ fontSize: 64, lineHeight: 72, fontVariant: ['tabular-nums'] }}>{elapsedText}</TextX>
                        <View className="flex-row items-center gap-4">
                            <ButtonX
                                variant="secondary"
                                style={{ minWidth: 112 }}
                                icon={isPaused ? Play : Pause}
                                disabled={actionLoading || phase === 'stopping'}
                                onPress={isPaused ? resumeRecord : pauseRecord}>
                                {isPaused ? '继续' : '暂停'}
                            </ButtonX>
                            <ButtonX
                                variant="destructive"
                                style={{ minWidth: 112 }}
                                icon={Square}
                                loading={phase === 'stopping'}
                                disabled={phase === 'stopping'}
                                onPress={stopRecord}>
                                停止
                            </ButtonX>
                        </View>
                    </View>
                )}
                <TextX>录音状态：{recordingStatusText}</TextX>
                {latestPath ? (
                    <TextX variant="description" style={{ color: mutedTextColor }} numberOfLines={2}>
                        最近保存：{latestPath}
                    </TextX>
                ) : null}
            </View>
        </DefaultLayout>
    );
}
