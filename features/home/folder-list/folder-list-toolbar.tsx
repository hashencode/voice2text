import { CheckCheck, FolderPlus, ListChecks, X } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { IconButton } from '~/components/ui/icon-button';
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
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');

    return (
        <View className="flex-row items-center justify-between rounded-t-3xl px-4 py-3" style={{ backgroundColor: cardColor }}>
            <View className="flex-grow flex-row items-center gap-x-2">
                <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                    {isMultiSelectMode ? actionMenuTitle : currentFolderLabel}
                </TextX>
            </View>
            <View className="h-9 flex-row items-center gap-x-2">
                {!isMultiSelectMode ? (
                    <IconButton icon={FolderPlus} size="sm" backgroundColor={secondaryColor} onPress={onCreateFolder} />
                ) : null}
                {isMultiSelectMode ? (
                    <IconButton
                        icon={CheckCheck}
                        size="sm"
                        backgroundColor={secondaryColor}
                        disabled={isToggleSelectAllDisabled}
                        onPress={onToggleSelectAll}
                        active={isAllSelected}
                    />
                ) : null}
                <IconButton
                    icon={isMultiSelectMode ? X : ListChecks}
                    size="sm"
                    backgroundColor={secondaryColor}
                    onPress={onToggleMultiSelectMode}
                />
            </View>
        </View>
    );
}
