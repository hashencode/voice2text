import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/layout/DefaultLayout';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
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
    const { actionLoading, buttonText, elapsedText, toggleRecord } = useWavRecording({
        sampleRate: 16000,
        createTargetPath: async () => {
            const directory = getRecordingsDir();
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            return createRecordingPath();
        },
    });

    return (
        <DefaultLayout head="录音" safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-1 items-center justify-center gap-6 px-6">
                <ButtonX loading={actionLoading} onPress={toggleRecord}>
                    {buttonText}
                </ButtonX>
                <TextX>{elapsedText}</TextX>
            </View>
        </DefaultLayout>
    );
}
