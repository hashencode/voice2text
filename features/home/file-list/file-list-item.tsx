import { Calendar, Clock } from 'iconoir-react-native';
import React from 'react';
import { View } from 'react-native';
import HomeListRowBase, { type HomeListRowBaseProps } from '~/features/home/common/home-list-row-base';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

type FileListItemProps = Pick<
    HomeListRowBaseProps,
    'name' | 'isFavorite' | 'onPress' | 'onLongPress' | 'onPressMore' | 'longPressDelayMs' | 'showArrow' | 'rightSlot'
> & {
    durationText: string;
    createdAtText: string;
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
    const metaTextStyle = {
        lineHeight: 14,
        includeFontPadding: false as const,
    };

    return (
        <HomeListRowBase
            name={name}
            isFavorite={isFavorite}
            onPress={onPress}
            onLongPress={onLongPress}
            onPressMore={onPressMore}
            longPressDelayMs={longPressDelayMs}
            showArrow={showArrow}
            rightSlot={rightSlot}
            meta={
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
            }
        />
    );
}
