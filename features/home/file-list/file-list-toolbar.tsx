import { ArrowLeft, CheckCheck, ListChecks, Search, X } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { IconButton } from '~/components/ui/icon-button';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

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
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');

    return (
        <View className="flex-row items-center justify-between rounded-t-3xl px-4 py-3" style={{ backgroundColor: cardColor }}>
            {isMultiSelectMode ? (
                <View className="flex-grow flex-row items-center gap-x-2">
                    <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                        {actionMenuTitle}
                    </TextX>
                </View>
            ) : (
                <View className="flex-grow flex-row items-center gap-x-2">
                    <IconButton icon={ArrowLeft} size="sm" backgroundColor={secondaryColor} onPress={onPressFolderTitle} />

                    <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                        {currentFolderLabel}
                    </TextX>
                </View>
            )}
            <View className="h-9 flex-row items-center gap-x-2">
                {!isMultiSelectMode ? (
                    <IconButton icon={Search} size="sm" backgroundColor={secondaryColor} onPress={onPressSearch} />
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
