import { Stack, useRouter } from 'expo-router';
import { Microphone } from 'iconoir-react-native';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DefaultLayout } from '~/components/layout/default-layout';
import { IconButton } from '~/components/ui/icon-button';
import HomeList from '~/features/home/home-list';
import { useColor } from '~/hooks/use-color';

export default function Home() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const primaryColor = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <HomeList bottomInset={insets.bottom} />

            <View className="absolute p-4" pointerEvents="box-none" style={{ bottom: insets.bottom }}>
                <IconButton
                    circular
                    size="default"
                    backgroundColor={primaryColor}
                    onPress={() => router.push('/record')}
                    className="!h-20 !w-20">
                    <Microphone width={34} height={34} color={primaryForegroundColor} />
                </IconButton>
            </View>
        </DefaultLayout>
    );
}
