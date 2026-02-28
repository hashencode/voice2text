import { Stack } from 'expo-router';

import React from 'react';
import { DefaultLayout } from '~/components/DefaultLayout';

import { Asset } from 'expo-asset';
import { Button } from '~/components/ui/button';
import SherpaOnnx from '~/modules/sherpa';

export default function Home() {
    const handleClick = async () => {
        // 1. 加载 asset
        const asset = Asset.fromModule(require('@/assets/0.wav'));
        // 2. 确保文件已经下载到本地
        await asset.downloadAsync();
        // 3. 获取 fileUri
        const fileUri = asset.localUri;
        console.info('@log', fileUri);
        if (fileUri) {
            const r1 = await SherpaOnnx.transcribeWav(fileUri);
            console.info('@log', r1.text);
        }
    };

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <Button onPress={handleClick}>123</Button>
        </DefaultLayout>
    );
}
