import { Stack } from 'expo-router';

import React, { useState } from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';

import { Asset } from 'expo-asset';
import { Button } from '~/components/ui/button';
import { FilePicker, useFilePicker } from '~/components/ui/file-picker';
import SherpaOnnx, { ensureModelReady, listLocalModels } from '~/modules/sherpa';

export default function Home() {
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState('未开始下载');

    const modelId = 'zipformer-zh-en-2023-11-22' as const;
    const MODEL_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models/';

    const getModels = async () => {
        const res = await listLocalModels();
        console.info('@log', res);
    };

    const { files } = useFilePicker();

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

    const handleClick = async () => {
        // 1. 加载 asset
        const asset = Asset.fromModule(require('@/assets/0.wav'));
        // 2. 确保文件已经下载到本地
        await asset.downloadAsync();
        // 3. 获取 fileUri
        const fileUri = asset.localUri;
        console.info('@log', fileUri);
        if (fileUri) {
            await ensureModelReady(modelId, { baseUrl: MODEL_BASE_URL });
            const r1 = await SherpaOnnx.transcribeWavByDownloadedModel(fileUri, modelId);
            console.info('@log', r1.text);
        }
    };

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ gap: 12 }}>
                <Button loading={downloading} onPress={handleDownloadModel}>
                    下载模型
                </Button>
                <Button disabled>{downloadStatus}</Button>
                <Button onPress={handleClick}>识别</Button>
                <Button onPress={getModels}>获取模型列表</Button>
                <FilePicker
                    onFilesSelected={files => console.log('Selected files:', files)}
                    onError={error => console.error('Error:', error)}
                    fileType="all"
                    multiple={true}
                    maxFiles={5}
                    placeholder="Select your files"
                />
                {console.log(files)}
            </View>
        </DefaultLayout>
    );
}
