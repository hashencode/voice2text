import { ArrowLeft, CheckCheck, ListChecks, Search, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS, BUTTON_HEIGHT } from '~/theme/globals';

type FileListToolbarProps = {
    isMultiSelectMode: boolean;
    actionMenuTitle: string;
    currentFolderLabel: string;
    onPressFolderTitle: () => void;
    onPressSearch: () => void;
    isAllSelected: boolean;
    isToggleSelectAllDisabled: boolean;
    onToggleSelectAll: () => void;
    onToggleMultiSelectMode: () => void;
};

export default function FileListToolbar({
    isMultiSelectMode,
    actionMenuTitle,
    currentFolderLabel,
    onPressFolderTitle,
    onPressSearch,
    isAllSelected,
    isToggleSelectAllDisabled,
    onToggleSelectAll,
    onToggleMultiSelectMode,
}: FileListToolbarProps) {
    const textColor = useColor('text');
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');

    return (
        <View
            className="flex-row items-center justify-between px-4 py-3"
            style={{ backgroundColor: cardColor, borderTopStartRadius: BORDER_RADIUS, borderTopEndRadius: BORDER_RADIUS }}>
            {isMultiSelectMode ? (
                <View className="flex-grow flex-row items-center gap-x-2">
                    <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                        {actionMenuTitle}
                    </TextX>
                </View>
            ) : (
                <View className="flex-grow flex-row items-center gap-x-2">
                    <Pressable
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: secondaryColor }}
                        onPress={onPressFolderTitle}>
                        <ArrowLeft size={16} strokeWidth={2.5} color={textColor} />
                    </Pressable>

                    <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                        {currentFolderLabel}
                    </TextX>
                </View>
            )}
            <View className="flex-row items-center gap-x-2" style={{ height: BUTTON_HEIGHT }}>
                {!isMultiSelectMode ? (
                    <Pressable
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: secondaryColor }}
                        onPress={onPressSearch}>
                        <Search size={16} color={textColor} />
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
