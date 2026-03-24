import { CalendarDays, CircleArrowRight, Clock } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

type FileListItemProps = {
    name: string;
    durationText: string;
    createdAtText: string;
};

export default function FileListItem({ name, durationText, createdAtText }: FileListItemProps) {
    const descriptionColor = useColor('textMuted');

    return (
        <View className="w-full flex-row items-center justify-between p-4">
            <View className="flex-1 gap-y-2.5 pr-4">
                <TextX className="!font-semibold" numberOfLines={1}>
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
                <ButtonX size="sm" variant="secondary" icon={CircleArrowRight}>
                    转文字
                </ButtonX>
            </View>
        </View>
    );
}
