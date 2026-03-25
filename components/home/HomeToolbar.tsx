import React from 'react';
import { ModeToggle } from '~/components/ui/mode-toggle';
import { TextX } from '~/components/ui/textx';
import { View } from '~/components/ui/view';

export default function HomeToolbar() {
    return (
        <View className="flex flex-row items-center justify-between px-6 py-1 pb-2">
            <TextX variant="subtitle">VoiceText</TextX>
            <ModeToggle />
        </View>
    );
}
