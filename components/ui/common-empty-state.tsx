import { SearchEngine } from 'iconoir-react-native';
import React from 'react';
import { View } from 'react-native';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

type CommonEmptyStateProps = {
    text: string;
};

export function CommonEmptyState({ text }: CommonEmptyStateProps) {
    const iconColor = useColor('textMuted');
    const textColor = useColor('textMuted');

    return (
        <View className="items-center justify-center px-6 pb-8 pt-28">
            <SearchEngine width={52} height={52} strokeWidth={1} color={iconColor} />
            <TextX className="mt-3 text-center text-[14px]" style={{ color: textColor }}>
                {text}
            </TextX>
        </View>
    );
}
