import '~/global.css';

import '~/i18n/translation';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { ToastProvider } from '~/components/ui/toast';
import { useRecordingRecovery } from '~/hooks/use-recording-recovery';
import '~/app/nativewind-interop';
import { ThemeProvider } from '~/theme/theme-provider';

export default function RootLayout() {
    useRecordingRecovery();

    return (
        <GestureHandlerRootView className="flex-1">
            <KeyboardProvider>
                <ToastProvider maxToasts={3}>
                    <ThemeProvider>
                        <Stack>
                            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        </Stack>
                    </ThemeProvider>
                </ToastProvider>
            </KeyboardProvider>
        </GestureHandlerRootView>
    );
}
