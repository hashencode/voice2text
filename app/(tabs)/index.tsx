import { Stack } from 'expo-router';
import { Search } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { IconButton } from '~/components/ui/icon-button';
import { ModeToggle } from '~/components/ui/mode-toggle';
import { useToast } from '~/components/ui/toast';
import HomeEntrance from '~/features/home/home-entrance';
import HomeList from '~/features/home/home-list';
import { useColor } from '~/hooks/useColor';

export default function Home() {
    const { toast } = useToast();
    const secondaryColor = useColor('secondary');

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-row justify-end gap-x-2 px-4 pt-4">
                <IconButton
                    icon={Search}
                    size="sm"
                    backgroundColor={secondaryColor}
                    onPress={() => toast({ title: '搜索功能即将上线', variant: 'info' })}
                />
                <ModeToggle />
            </View>
            <HomeEntrance />
            <HomeList />
        </DefaultLayout>
    );
}
