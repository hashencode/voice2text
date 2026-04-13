import { Ellipsis, Heart } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';
import { FONT_SIZE_LG } from '~/theme/globals';

export type HomeListRowBaseProps = {
    name: string;
    isFavorite?: boolean;
    meta: React.ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    onPressMore?: () => void;
    longPressDelayMs?: number;
    showArrow?: boolean;
    rightSlot?: React.ReactNode;
};

export default function HomeListRowBase({
    name,
    isFavorite = false,
    meta,
    onPress,
    onLongPress,
    onPressMore,
    longPressDelayMs = 500,
    showArrow = true,
    rightSlot,
}: HomeListRowBaseProps) {
    const actionIconColor = useColor('text');

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

                {meta}
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
