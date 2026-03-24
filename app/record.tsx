import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/layout/DefaultLayout';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { upsertRecordingMeta } from '~/db/sqlite/services/recordings.service';
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
    const [recordingStatusText, setRecordingStatusText] = useState('未开始录音');

    const { actionLoading, buttonText, elapsedText, toggleRecord } = useWavRecording({
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

    return (
        <DefaultLayout headTitle="录音" safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-1 items-center justify-center gap-6 px-6">
                <ButtonX loading={actionLoading} onPress={toggleRecord}>
                    {buttonText}
                </ButtonX>
                <TextX>录音状态：{recordingStatusText}</TextX>
                <TextX>{elapsedText}</TextX>
            </View>
        </DefaultLayout>
    );
}
