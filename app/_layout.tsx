import '~/global.css';

import '~/i18n/translation';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '~/scripts/interop';
import { ThemeProvider } from '~/theme/theme-provider';

export default function RootLayout() {
    return (
        <GestureHandlerRootView>
            <ThemeProvider>
                <Stack>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}
