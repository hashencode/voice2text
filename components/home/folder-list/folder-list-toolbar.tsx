import { CheckCheck, FolderPlus, ListChecks, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS, BUTTON_HEIGHT } from '~/theme/globals';

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
            className="flex-row items-center justify-between px-4 pb-1 pt-3"
            style={{ backgroundColor: cardColor, borderTopStartRadius: BORDER_RADIUS, borderTopEndRadius: BORDER_RADIUS }}>
            <View className="flex-grow flex-row items-center gap-x-2">
                <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                    {isMultiSelectMode ? actionMenuTitle : currentFolderLabel}
                </TextX>
            </View>
            <View className="flex-row items-center gap-x-2" style={{ height: BUTTON_HEIGHT }}>
                {!isMultiSelectMode ? (
                    <Pressable
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: secondaryColor }}
                        onPress={onCreateFolder}>
                        <FolderPlus size={16} color={textColor} />
                    </Pressable>
                ) : null}
                {isMultiSelectMode ? (
                    <Pressable
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{
                            backgroundColor: secondaryColor,
                            opacity: isToggleSelectAllDisabled ? 0.45 : 1,
                        }}
                        disabled={isToggleSelectAllDisabled}
                        onPress={onToggleSelectAll}>
                        <CheckCheck size={16} color={textColor} strokeWidth={isAllSelected ? 2.3 : 2} />
                    </Pressable>
                ) : null}
                <Pressable
                    className="h-9 w-9 items-center justify-center rounded-xl"
                    style={{ backgroundColor: secondaryColor }}
                    onPress={onToggleMultiSelectMode}>
                    {isMultiSelectMode ? <X size={16} color={textColor} /> : <ListChecks size={16} color={textColor} />}
                </Pressable>
            </View>
        </View>
    );
}
