import { Stack } from 'expo-router';
import React from 'react';
import HomeEntrance from '~/components/home/home-entrance';
import HomeList from '~/components/home/home-list';
import { DefaultLayout } from '~/components/layout/default-layout';

export default function Home() {
    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <HomeEntrance />
            <HomeList />
        </DefaultLayout>
    );
}
