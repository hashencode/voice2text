import '~/global.css';

import '~/i18n/translation';

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeBundledModel } from '~/modules/sherpa';
import { ThemeProvider } from '~/theme/theme-provider';
import '~/utils/interop';

export default function RootLayout() {
    useEffect(() => {
        initializeBundledModel('zipformer-zh-en-2023-11-22').catch(error => {
            console.error('[sherpa] initialize bundled model failed', error);
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
