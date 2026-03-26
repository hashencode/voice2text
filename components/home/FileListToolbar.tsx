import { ArrowUp, FolderPlus, Search, SquareCheckBig, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Picker, type PickerOption } from '~/components/ui/picker';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS, BUTTON_HEIGHT } from '~/theme/globals';

type FileListToolbarProps = {
    isMultiSelectMode: boolean;
    actionMenuTitle: string;
    folderOptions: PickerOption[];
    selectedFolder: string;
    isResetFolderDisabled: boolean;
    onSelectFolder: (value: string) => void;
    onResetFolder: () => void;
    onToggleMultiSelectMode: () => void;
};

export default function FileListToolbar({
    isMultiSelectMode,
    actionMenuTitle,
    folderOptions,
    selectedFolder,
    isResetFolderDisabled,
    onSelectFolder,
    onResetFolder,
    onToggleMultiSelectMode,
}: FileListToolbarProps) {
    const textColor = useColor('text');
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');

    return (
        <View
            className="flex-row items-center justify-between px-4 pb-1 pt-3"
            style={{ backgroundColor: cardColor, borderTopStartRadius: BORDER_RADIUS, borderTopEndRadius: BORDER_RADIUS }}>
            {isMultiSelectMode ? (
                <Pressable className="h-9 justify-center rounded-xl px-3" style={{ backgroundColor: secondaryColor }}>
                    <TextX>{actionMenuTitle}</TextX>
                </Pressable>
            ) : (
                <View className="w-1/2">
                    <Picker
                        options={folderOptions}
                        value={selectedFolder}
                        onValueChange={onSelectFolder}
                        variant="outline"
                        modalTitle="选择文件夹"
                        placeholder="全部文件夹"
                    />
                </View>
            )}
            <View className="flex-row items-center gap-x-2" style={{ height: BUTTON_HEIGHT }}>
                {!isMultiSelectMode ? (
                    <>
                        <Pressable
                            className="h-9 w-9 items-center justify-center rounded-xl"
                            style={{ backgroundColor: secondaryColor }}
                            disabled={isResetFolderDisabled}
                            onPress={onResetFolder}>
                            <ArrowUp size={16} color={textColor} />
                        </Pressable>
                        <Pressable
                            className="h-9 w-9 items-center justify-center rounded-xl"
                            style={{ backgroundColor: secondaryColor }}
                            onPress={() => {}}>
                            <FolderPlus size={16} color={textColor} />
                        </Pressable>
                        <Pressable
                            className="h-9 w-9 items-center justify-center rounded-xl"
                            style={{ backgroundColor: secondaryColor }}
                            onPress={() => {}}>
                            <Search size={16} color={textColor} />
                        </Pressable>
                    </>
                ) : null}
                <Pressable
                    className="h-9 w-9 items-center justify-center rounded-xl"
                    style={{ backgroundColor: secondaryColor }}
                    onPress={onToggleMultiSelectMode}>
                    {isMultiSelectMode ? <X size={16} color={textColor} /> : <SquareCheckBig size={16} color={textColor} />}
                </Pressable>
            </View>
        </View>
    );
}
