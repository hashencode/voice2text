import { CheckCheck, FolderPlus, ListChecks, X } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import ToolbarIconButton from '~/features/home/common/toolbar-icon-button';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

type FolderListToolbarProps = {
    isMultiSelectMode: boolean;
    actionMenuTitle: string;
    currentFolderLabel: string;
    onCreateFolder: () => void;
    isAllSelected: boolean;
    isToggleSelectAllDisabled: boolean;
    onToggleSelectAll: () => void;
    onToggleMultiSelectMode: () => void;
};

export default function FolderListToolbar({
    isMultiSelectMode,
    actionMenuTitle,
    currentFolderLabel,
    onCreateFolder,
    isAllSelected,
    isToggleSelectAllDisabled,
    onToggleSelectAll,
    onToggleMultiSelectMode,
}: FolderListToolbarProps) {
    const textColor = useColor('text');
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');

    return (
        <View
            className="flex-row items-center justify-between rounded-t-[26px] px-4 py-3"
            style={{ backgroundColor: cardColor }}>
            <View className="flex-grow flex-row items-center gap-x-2">
                <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                    {isMultiSelectMode ? actionMenuTitle : currentFolderLabel}
                </TextX>
            </View>
            <View className="h-9 flex-row items-center gap-x-2">
                {!isMultiSelectMode ? (
                    <ToolbarIconButton backgroundColor={secondaryColor} onPress={onCreateFolder}>
                        <FolderPlus size={16} color={textColor} />
                    </ToolbarIconButton>
                ) : null}
                {isMultiSelectMode ? (
                    <ToolbarIconButton
                        backgroundColor={secondaryColor}
                        disabled={isToggleSelectAllDisabled}
                        onPress={onToggleSelectAll}>
                        <CheckCheck size={16} color={textColor} strokeWidth={isAllSelected ? 2.3 : 2} />
                    </ToolbarIconButton>
                ) : null}
                <ToolbarIconButton backgroundColor={secondaryColor} onPress={onToggleMultiSelectMode}>
                    {isMultiSelectMode ? <X size={16} color={textColor} /> : <ListChecks size={16} color={textColor} />}
                </ToolbarIconButton>
            </View>
        </View>
    );
}
