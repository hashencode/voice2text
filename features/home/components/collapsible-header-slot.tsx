import React from 'react';
import { StyleProp, TextStyle, View } from 'react-native';
import { TextX } from '~/components/ui/textx';

type CollapsibleHeaderSlotProps = {
    title: string;
    description: string;
    titleStyle?: StyleProp<TextStyle>;
    onTitleLayout?: (width: number, height: number, x: number, y: number) => void;
};

export default function CollapsibleHeaderSlot({ title, description, titleStyle, onTitleLayout }: CollapsibleHeaderSlotProps) {
    return (
        <View className="px-4 pb-2 pt-1">
            <View
                className="self-start"
                onLayout={event => {
                    const { width, height, x, y } = event.nativeEvent.layout;
                    onTitleLayout?.(width, height, x, y);
                }}>
                <TextX style={[titleStyle, { opacity: 0 }]}>{title}</TextX>
            </View>
            <TextX variant="description" className="px-1">
                {description}
            </TextX>
        </View>
    );
}
