import { Stack } from 'expo-router';
import { View } from 'react-native';

import React from 'react';
import { DefaultLayout } from '~/components/DefaultLayout';

import { Ellipsis } from 'lucide-react-native';
import { TextX } from '~/components/ui/text';
import BlockAddPet from '~/features/home/components/BlockAddPet';
import ChartWeight from '~/features/home/components/ChartWeight';
import GroupTools from '~/features/home/components/GroupTools';

export default function Home() {
    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />

            <BlockAddPet />

            <View className="px-3 py-4">
                <View className="mb-3 flex w-full flex-row items-center justify-between pr-3">
                    <TextX className="text-secondary">实用工具</TextX>
                    <Ellipsis />
                </View>

                <GroupTools />
            </View>

            <View className="px-3 py-4">
                <View className="mb-3 flex w-full flex-row items-center justify-between pr-3">
                    <TextX className="text-secondary">趋势</TextX>
                </View>

                <ChartWeight />
            </View>
        </DefaultLayout>
    );
}
