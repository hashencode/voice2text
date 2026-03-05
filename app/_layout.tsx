import '~/global.css';

import '~/i18n/translation';

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeBundledModel, type SherpaModelId } from '~/modules/sherpa';
import { ThemeProvider } from '~/theme/theme-provider';
import '~/utils/interop';

export default function RootLayout() {
    useEffect(() => {
        // Temporary test: extract all bundled model zips in assets/sherpa/models.
        const runExtractAllModelsTest = async () => {
            for (const modelId of [
                // 'zipformer-zh-streaming',
                // 'zipformer-ctc-zh',
                'funasr-nano',
            ]) {
                try {
                    await initializeBundledModel(modelId as SherpaModelId);
                    console.info('[sherpa] bundled model extracted', modelId);
                } catch (error) {
                    console.error('[sherpa] initialize bundled model failed', modelId, error);
                }
            }
        };

        runExtractAllModelsTest().catch(error => {
            console.error('[sherpa] extract all bundled models failed', error);
        });
    }, []);

    return (
        <GestureHandlerRootView>
            <ThemeProvider>
                <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                </Stack>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}
