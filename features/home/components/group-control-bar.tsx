import { CheckCheck, FolderInput, Library, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { IconButton } from '~/components/ui/icon-button';
import { TextX } from '~/components/ui/textx';
import { getGroupLabel } from '~/data/sqlite/group-model';
import { useColor } from '~/hooks/useColor';
import { BUTTON_HEIGHT } from '~/theme/globals';

type GroupControlBarProps = {
    isMultiSelectMode: boolean;
    groupTabs?: string[];
    selectedGroupId?: string;
    selectedCount?: number;
    canSelectAll?: boolean;
    isAllFilteredSelected?: boolean;
    onPressGroup?: (groupId: string) => void;
    onOpenGroups?: () => void;
    onToggleSelectAllFiltered?: () => void;
    onMoveSelected?: () => void;
    onDeleteSelected?: () => void;
    onCloseMultiSelect?: () => void;
};

export default function GroupControlBar({
    isMultiSelectMode,
    groupTabs = [],
    selectedGroupId = '',
    selectedCount = 0,
    canSelectAll = false,
    isAllFilteredSelected = false,
    onPressGroup,
    onOpenGroups,
    onToggleSelectAllFiltered,
    onMoveSelected,
    onDeleteSelected,
    onCloseMultiSelect,
}: GroupControlBarProps) {
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');
    const destructiveColor = useColor('red');

    if (isMultiSelectMode) {
        const disableActions = selectedCount <= 0;
        return (
            <View className="flex-row items-center justify-between gap-x-2 px-4 py-3">
                <TextX variant="title" numberOfLines={1} className="flex-1">
                    {selectedCount <= 0 ? '选择项目' : `已选择 ${selectedCount} 项`}
                </TextX>
                <View className="flex-row items-center gap-x-2">
                    <IconButton icon={FolderInput} disabled={disableActions} onPress={onMoveSelected} />
                    <IconButton
                        icon={Trash2}
                        disabled={disableActions}
                        onPress={onDeleteSelected}
                        iconProps={{ color: destructiveColor }}
                    />
                    <IconButton
                        icon={CheckCheck}
                        disabled={!canSelectAll}
                        onPress={onToggleSelectAllFiltered}
                        active={isAllFilteredSelected}
                    />
                    <IconButton icon={X} onPress={onCloseMultiSelect} />
                </View>
            </View>
        );
    }

    return (
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
    );
}
