import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { ModeToggle } from '~/components/ui/mode-toggle';
import HomeEntrance from '~/features/home/home-entrance';
import HomeList from '~/features/home/home-list';
import { DefaultLayout } from '~/components/layout/default-layout';

export default function Home() {
    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-row justify-end px-4 pt-4">
                <ModeToggle />
            </View>
            <HomeEntrance />
            <HomeList />
        </DefaultLayout>
    );
}
