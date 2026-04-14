import { ArrowLeft, CheckCheck, ListChecks, Search, X } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { IconToolbarButton } from '~/components/ui/icon-toolbar-button';
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
    const textColor = useColor('text');
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');

    return (
        <View className="flex-row items-center justify-between rounded-t-[26px] px-4 py-3" style={{ backgroundColor: cardColor }}>
            {isMultiSelectMode ? (
                <View className="flex-grow flex-row items-center gap-x-2">
                    <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                        {actionMenuTitle}
                    </TextX>
                </View>
            ) : (
                <View className="flex-grow flex-row items-center gap-x-2">
                    <IconToolbarButton className="h-8 w-8" backgroundColor={secondaryColor} onPress={onPressFolderTitle}>
                        <ArrowLeft size={16} strokeWidth={2.5} color={textColor} />
                    </IconToolbarButton>

                    <TextX variant="title" numberOfLines={1} ellipsizeMode="tail">
                        {currentFolderLabel}
                    </TextX>
                </View>
            )}
            <View className="h-9 flex-row items-center gap-x-2">
                {!isMultiSelectMode ? (
                    <IconToolbarButton backgroundColor={secondaryColor} onPress={onPressSearch}>
                        <Search size={16} color={textColor} />
                    </IconToolbarButton>
                ) : null}
                {isMultiSelectMode ? (
                    <IconToolbarButton backgroundColor={secondaryColor} disabled={isToggleSelectAllDisabled} onPress={onToggleSelectAll}>
                        <CheckCheck size={16} color={textColor} strokeWidth={isAllSelected ? 2.3 : 2} />
                    </IconToolbarButton>
                ) : null}
                <IconToolbarButton backgroundColor={secondaryColor} onPress={onToggleMultiSelectMode}>
                    {isMultiSelectMode ? <X size={16} color={textColor} /> : <ListChecks size={16} color={textColor} />}
                </IconToolbarButton>
            </View>
        </View>
    );
}
