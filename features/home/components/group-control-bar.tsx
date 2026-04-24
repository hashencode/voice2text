import { Library } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { IconButton } from '~/components/ui/icon-button';
import { Separator } from '~/components/ui/separator';
import { TextX } from '~/components/ui/textx';
import { getGroupLabel } from '~/data/sqlite/group-model';
import { useColor } from '~/hooks/useColor';
import { BUTTON_HEIGHT } from '~/theme/globals';

type GroupControlBarProps = {
    groupTabs?: string[];
    selectedGroupId?: string;
    onPressGroup?: (groupId: string) => void;
    onOpenGroups?: () => void;
};

export default function GroupControlBar({
    groupTabs = [],
    selectedGroupId = '',
    onPressGroup,
    onOpenGroups,
}: GroupControlBarProps) {
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');

    return (
        <>
            <View className="flex-row items-center gap-x-2 px-4 py-3">
                <IconButton icon={Library} backgroundColor={cardColor} onPress={onOpenGroups} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
                    {groupTabs.map(groupId => {
                        const isActive = selectedGroupId === groupId;
                        return (
                            <Pressable
                                key={groupId}
                                onPress={() => onPressGroup?.(groupId)}
                                className="flex justify-center rounded-xl px-4"
                                style={{ backgroundColor: isActive ? secondaryColor : cardColor, height: BUTTON_HEIGHT }}>
                                <TextX className={isActive ? 'font-medium' : ''}>{getGroupLabel(groupId)}</TextX>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>
            <Separator />
        </>
    );
}
