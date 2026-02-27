import { Stack } from 'expo-router';

import React from 'react';
import { DefaultLayout } from '~/components/DefaultLayout';

import SherpaOnnx from '@/modules/sherpa';
import { TextX } from '~/components/ui/text';

export default function Home() {
    console.log(SherpaOnnx.hello());

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <TextX>123</TextX>
        </DefaultLayout>
    );
}
