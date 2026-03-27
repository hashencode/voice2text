import { ArrowRight, CalendarDays, Clock } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

type FileListItemProps = {
    name: string;
    durationText: string;
    createdAtText: string;
    onPress?: () => void;
    onLongPress?: () => void;
    longPressDelayMs?: number;
    showArrow?: boolean;
    rightSlot?: React.ReactNode;
};

export default function FileListItem({
    name,
    durationText,
    createdAtText,
    onPress,
    onLongPress,
    longPressDelayMs = 500,
    showArrow = true,
    rightSlot,
}: FileListItemProps) {
    const descriptionColor = useColor('textMuted');

    return (
        <Pressable
            className="w-full flex-row items-center justify-between p-4"
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={longPressDelayMs}>
            <View className="flex-1 gap-y-2.5 pr-4">
                <TextX variant="subtitle" numberOfLines={1}>
                    {name}
                </TextX>

                <View className="flex-row items-center gap-x-4 gap-y-1">
                    <View className="flex-row items-center gap-x-1.5">
                        <Clock size={13} color={descriptionColor} />
                        <TextX variant="description">{durationText}</TextX>
                    </View>
                    <View className="flex-row items-center gap-x-1.5">
                        <CalendarDays size={13} color={descriptionColor} />
                        <TextX variant="description">{createdAtText}</TextX>
                    </View>
                </View>
            </View>

            <View className="shrink-0">
                {rightSlot ?? (showArrow ? <ButtonX size="icon" variant="secondary" icon={ArrowRight} /> : null)}
            </View>
        </Pressable>
    );
}
