import { CalendarDays, Clock } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

export default function FileListItem() {
    const descriptionColor = useColor('textMuted');

    return (
        <View className="flex flex-row items-stretch justify-between">
            <View className="flex gap-y-2.5">
                <View>
                    <TextX variant="subtitle" className="!font-semibold" numberOfLines={1}>
                        新录音
                    </TextX>
                </View>
                <View className="flex flex-row items-center gap-x-4">
                    <View className="flex flex-row items-center gap-x-1.5">
                        <Clock size={14} color={descriptionColor} />
                        <TextX variant="description">00:09</TextX>
                    </View>
                    <View className="flex flex-row items-center gap-x-1.5">
                        <CalendarDays size={14} color={descriptionColor} />
                        <TextX variant="description">03-09 18:17</TextX>
                    </View>
                </View>
            </View>
            <View className="flex justify-center">
                <ButtonX size="sm" variant={'secondary'}>
                    转文字
                </ButtonX>
            </View>
        </View>
    );
}
