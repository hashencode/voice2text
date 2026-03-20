import { Stack } from 'expo-router';
import React from 'react';
import FileList from '~/components/home/FileList';
import HeadTab from '~/components/home/HeadTab';
import { DefaultLayout } from '~/components/layout/DefaultLayout';

export default function Home() {
    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <HeadTab />
            <FileList />
        </DefaultLayout>
    );
}
