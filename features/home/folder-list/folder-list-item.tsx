import { Calendar, MusicDoubleNote } from 'iconoir-react-native';
import React from 'react';
import { View } from 'react-native';
import HomeListRowBase, { type HomeListRowBaseProps } from '~/features/home/common/home-list-row-base';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

type FolderListItemProps = Pick<
    HomeListRowBaseProps,
    'name' | 'isFavorite' | 'onPress' | 'onLongPress' | 'onPressMore' | 'longPressDelayMs' | 'showArrow' | 'rightSlot'
> & {
    fileCountText: string;
    createdAtText: string;
    showCreatedAt?: boolean;
};

export default function FolderListItem({
    name,
    isFavorite = false,
    fileCountText,
    createdAtText,
    showCreatedAt = true,
    onPress,
    onLongPress,
    onPressMore,
    longPressDelayMs = 500,
    showArrow = true,
    rightSlot,
}: FolderListItemProps) {
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
                        <MusicDoubleNote width={14} height={14} strokeWidth={2} color={descriptionColor} />
                        <TextX variant="description" style={metaTextStyle}>
                            {fileCountText}
                        </TextX>
                    </View>
                    {showCreatedAt ? (
                        <View className="flex-row items-center gap-x-1.5">
                            <Calendar width={14} height={14} strokeWidth={2} color={descriptionColor} />
                            <TextX variant="description" style={metaTextStyle}>
                                {createdAtText}
                            </TextX>
                        </View>
                    ) : null}
                </View>
            }
        />
    );
}
