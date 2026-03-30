import { Calendar, Clock } from 'iconoir-react-native';
import { Ellipsis, Heart } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';
import { FONT_SIZE_LG } from '~/theme/globals';

type FileListItemProps = {
    name: string;
    isFavorite?: boolean;
    durationText: string;
    createdAtText: string;
    onPress?: () => void;
    onLongPress?: () => void;
    onPressMore?: () => void;
    longPressDelayMs?: number;
    showArrow?: boolean;
    rightSlot?: React.ReactNode;
};

export default function FileListItem({
    name,
    isFavorite = false,
    durationText,
    createdAtText,
    onPress,
    onLongPress,
    onPressMore,
    longPressDelayMs = 500,
    showArrow = true,
    rightSlot,
}: FileListItemProps) {
    const descriptionColor = useColor('textMuted');
    const actionIconColor = useColor('text');
    const metaTextStyle = {
        lineHeight: 14,
        includeFontPadding: false as const,
    };

    return (
        <Pressable
            className="h-24 w-full flex-row items-center justify-between p-4"
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={longPressDelayMs}>
            <View className="flex-1 gap-y-2.5 pr-4">
                <View className="flex-row items-center gap-x-1">
                    {isFavorite ? <Heart size={FONT_SIZE_LG} color="#EF4444" /> : null}
                    <TextX variant="subtitle" numberOfLines={1} className="flex-1">
                        {name}
                    </TextX>
                </View>

                <View className="flex-row items-center gap-x-4 gap-y-1">
                    <View className="flex-row items-center gap-x-1.5">
                        <Clock width={14} height={14} strokeWidth={2} color={descriptionColor} />
                        <TextX variant="description" style={metaTextStyle}>
                            {durationText}
                        </TextX>
                    </View>
                    <View className="flex-row items-center gap-x-1.5">
                        <Calendar width={14} height={14} strokeWidth={2} color={descriptionColor} />
                        <TextX variant="description" style={metaTextStyle}>
                            {createdAtText}
                        </TextX>
                    </View>
                </View>
            </View>

            <View className="shrink-0">
                {rightSlot ??
                    (showArrow ? (
                        <BouncyPressable
                            scaleIn={1.2}
                            onPress={event => {
                                event.stopPropagation();
                                onPressMore?.();
                            }}>
                            <View className="h-9 w-9 items-center justify-center rounded-xl">
                                <Ellipsis size={18} color={actionIconColor} />
                            </View>
                        </BouncyPressable>
                    ) : null)}
            </View>
        </Pressable>
    );
}
