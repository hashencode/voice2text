import '~/global.css';

import '~/i18n/translation';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '~/theme/theme-provider';
import '~/utils/interop';

export default function RootLayout() {
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
