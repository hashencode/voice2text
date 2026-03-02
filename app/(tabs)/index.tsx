import { Stack } from 'expo-router';

import React, { useState } from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';

import { Asset } from 'expo-asset';
import { Button } from '~/components/ui/button';
import SherpaOnnx, { downloadModel, isModelDownloaded } from '~/modules/sherpa';

export default function Home() {
    const [downloading, setDownloading] = useState(false);

    const modelId = 'streaming-zipformer-bilingual-zh-en-2023-02-20' as const;

    const handleDownloadModel = async () => {
        setDownloading(true);
        try {
            const localDir = await downloadModel(modelId);
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
            const downloaded = await isModelDownloaded(modelId);
            if (!downloaded) {
                throw new Error(`Model not downloaded: ${modelId}`);
            }
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
                <Button onPress={handleClick}>识别</Button>
            </View>
        </DefaultLayout>
    );
}
