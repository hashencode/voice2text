import { Stack } from 'expo-router';

import React, { useState } from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';

import { AudioRecorder } from '~/components/ui/audio-recorder';
import { Button } from '~/components/ui/button';
import { TextX } from '~/components/ui/text';
import { useFilePicker } from '~/hooks/useFilePicker';
import SherpaOnnx, { ensureModelReady, listLocalModels } from '~/modules/sherpa';

export default function Home() {
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState('未开始下载');
    const [modelsListText, setModelsListText] = useState('');
    const [conversionText, setConversionText] = useState('');

    const modelId = 'zipformer-zh-en-2023-11-22' as const;
    const MODEL_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models/';

    const getModels = async () => {
        const res = await listLocalModels();
        setModelsListText(JSON.stringify(res));
        console.info('@log', typeof res);
    };

    const { pickDocument } = useFilePicker({
        multiple: true,
        onFilesSelected: selected => handleConversion(selected[0]?.uri),
        onError: error => console.error('Error:', error),
    });

    const handleDownloadModel = async () => {
        setDownloading(true);
        try {
            const localDir = await ensureModelReady(modelId, {
                baseUrl: MODEL_BASE_URL,
                onProgress: progress => {
                    if (progress.phase === 'downloading-zip') {
                        const percent = progress.percent ? `${Math.round(progress.percent * 100)}%` : '';
                        setDownloadStatus(`下载中 ${percent}`.trim());
                    } else if (progress.phase === 'verifying') {
                        setDownloadStatus('校验中');
                    } else if (progress.phase === 'extracting') {
                        setDownloadStatus('解压中');
                    } else if (progress.phase === 'ready') {
                        setDownloadStatus('模型就绪');
                    } else {
                        setDownloadStatus('获取模型信息');
                    }
                },
            });
            console.info('@log model downloaded', modelId, localDir);
        } finally {
            setDownloading(false);
        }
    };

    const handleConversion = async (uri: string) => {
        if (uri) {
            await ensureModelReady(modelId, { baseUrl: uri });
            const r1 = await SherpaOnnx.transcribeWavByDownloadedModel(uri, modelId);
            setConversionText(r1.text);
        }
    };

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ gap: 12 }}>
                <Button loading={downloading} onPress={handleDownloadModel}>
                    下载模型
                </Button>
                <TextX>{downloadStatus}</TextX>
                <Button onPress={getModels}>获取模型列表</Button>
                <TextX>{modelsListText}</TextX>
                <Button onPress={pickDocument}>选择文件</Button>
                <TextX>{conversionText}</TextX>
                <AudioRecorder
                    quality="high"
                    showWaveform={true}
                    showTimer={true}
                    onRecordingComplete={uri => {
                        console.log('Recording saved to:', uri);
                    }}
                />
            </View>
        </DefaultLayout>
    );
}
