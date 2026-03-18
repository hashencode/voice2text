import { AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';
import { Button } from '~/components/ui/button';
import { TextX } from '~/components/ui/text';
import SherpaOnnx from '~/modules/sherpa';

type SavedRecordingItem = {
    path: string;
    sampleRate: number | null;
    numSamples: number | null;
};

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
    const [recordingActionLoading, setRecordingActionLoading] = useState(false);
    const [isRecordingByButton, setIsRecordingByButton] = useState(false);
    const [recordingStatusText, setRecordingStatusText] = useState('未开始录音');
    const [savedRecordings, setSavedRecordings] = useState<SavedRecordingItem[]>([]);

    const refreshSavedRecordings = useCallback(async () => {
        try {
            const directory = getRecordingsDir();
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            const files = await FileSystem.readDirectoryAsync(directory);
            const wavPaths = files.filter(fileName => fileName.endsWith('.wav')).map(fileName => `${directory}${fileName}`);
            setSavedRecordings(
                wavPaths
                    .sort((left, right) => right.localeCompare(left))
                    .map(path => ({
                        path,
                        sampleRate: null,
                        numSamples: null,
                    })),
            );
        } catch (error) {
            setRecordingStatusText(`读取录音列表失败: ${(error as Error).message}`);
        }
    }, []);

    const toggleRecordAndSave = useCallback(async () => {
        if (recordingActionLoading) {
            return;
        }

        setRecordingActionLoading(true);
        try {
            if (!isRecordingByButton) {
                const permission = await AudioModule.requestRecordingPermissionsAsync();
                if (!permission.granted) {
                    setRecordingStatusText('未获得麦克风权限');
                    return;
                }

                const directory = getRecordingsDir();
                await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
                const targetPath = createRecordingPath();
                await SherpaOnnx.startWavRecording({ sampleRate: 16000, path: targetPath });
                setIsRecordingByButton(true);
                setRecordingStatusText('录音中，再次点击停止并保存');
                return;
            }

            const wavResult = await SherpaOnnx.stopWavRecording();
            setIsRecordingByButton(false);

            if (!wavResult.path) {
                setRecordingStatusText('停止录音失败，未拿到音频文件');
                return;
            }

            setSavedRecordings(prev => [
                {
                    path: wavResult.path,
                    sampleRate: wavResult.sampleRate,
                    numSamples: wavResult.numSamples,
                },
                ...prev.filter(item => item.path !== wavResult.path),
            ]);
            setRecordingStatusText('录音完成，音频已保存');
        } catch (error) {
            setIsRecordingByButton(false);
            setRecordingStatusText(`录音/保存失败: ${(error as Error).message}`);
        } finally {
            setRecordingActionLoading(false);
        }
    }, [isRecordingByButton, recordingActionLoading]);

    useEffect(() => {
        refreshSavedRecordings().catch(error => {
            setRecordingStatusText(`读取录音列表失败: ${(error as Error).message}`);
        });
    }, [refreshSavedRecordings]);

    useEffect(() => {
        return () => {
            if (!SherpaOnnx.isWavRecording()) {
                return;
            }
            SherpaOnnx.stopWavRecording().catch(error => {
                console.error('[record-page] stop recording on unmount failed', error);
            });
        };
    }, []);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-6">
                <Button loading={recordingActionLoading} onPress={toggleRecordAndSave}>
                    {isRecordingByButton ? '停止录音并保存' : '开始录音'}
                </Button>
                <TextX>录音状态：{recordingStatusText}</TextX>

                <View className="gap-2">
                    <TextX variant="description">已保存录音：{savedRecordings.length}</TextX>
                    {savedRecordings.map(item => (
                        <View key={item.path} className="border-border rounded-xl border px-3 py-2">
                            <TextX numberOfLines={1} variant="description">
                                {item.path}
                            </TextX>
                            <TextX variant="description">
                                {item.sampleRate ? `采样率: ${item.sampleRate} Hz` : '采样率: 未知'}
                            </TextX>
                            <TextX variant="description">
                                {item.numSamples !== null ? `采样点: ${item.numSamples}` : '采样点: 未知'}
                            </TextX>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </DefaultLayout>
    );
}
