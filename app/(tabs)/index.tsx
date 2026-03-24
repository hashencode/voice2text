import { Stack } from 'expo-router';
import React from 'react';
import FileList from '~/components/home/FileList';
import HomeEntrance from '~/components/home/HomeEntrance';
import HomeToolbar from '~/components/home/HomeToolbar';
import { DefaultLayout } from '~/components/layout/DefaultLayout';

export default function Home() {
    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <HomeToolbar />
            <HomeEntrance />
            <FileList />
        </DefaultLayout>
    );
}
