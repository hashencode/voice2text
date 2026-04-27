import { CheckCheck, Pencil, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/use-color';
import { BUTTON_HEIGHT_LG, BUTTON_ICON_LG, FONT_SIZE, FONT_SIZE_LG } from '~/theme/globals';

export type SelectionModeActionType = 'cancel' | 'selectAll' | 'rename' | 'delete';

export const BOTTOM_TOOLBAR_HEIGHT = BUTTON_HEIGHT_LG + 20;

type SelectionModeLayoutProps = {
    left: React.ReactNode;
    right: React.ReactNode;
    isSelectionMode: boolean;
    selectedCount: number;
    canSelectAll?: boolean;
    bottomActions?: SelectionModeActionType[];
    onAction?: (action: SelectionModeActionType) => void;
    topBarMinHeight?: number;
};

export default function SelectionModeLayout({
    left,
    right,
    isSelectionMode,
    selectedCount,
    canSelectAll = true,
    bottomActions = [],
    onAction,
    topBarMinHeight = BUTTON_HEIGHT_LG,
}: SelectionModeLayoutProps) {
    const backgroundColor = useColor('background');
    const cardColor = useColor('card');
    const textColor = useColor('text');
    const destructiveColor = useColor('red');
    const insets = useSafeAreaInsets();

    const actionMeta: Record<
        SelectionModeActionType,
        {
            label: string;
            color: string;
            icon: React.ComponentType<{ size?: number; color?: string }>;
            disabled: boolean;
        }
    > = {
        cancel: { label: '取消', color: destructiveColor, icon: X, disabled: false },
        selectAll: { label: '全选', color: textColor, icon: CheckCheck, disabled: !canSelectAll },
        rename: { label: '重命名', color: textColor, icon: Pencil, disabled: selectedCount !== 1 },
        delete: { label: '删除', color: destructiveColor, icon: Trash2, disabled: selectedCount === 0 },
    };

    return (
        <>
            <View className="px-4 pb-2 pt-4" style={{ backgroundColor }}>
                <View className="flex-row items-center gap-x-2" style={{ minHeight: topBarMinHeight }}>
                    {isSelectionMode ? (
                        <>
                            <View className="flex-1 items-start">
                                <Pressable
                                    disabled={actionMeta.cancel.disabled}
                                    onPress={() => onAction?.('cancel')}
                                    className="justify-center rounded-full px-2"
                                    style={{ height: BUTTON_HEIGHT_LG }}>
                                    <TextX style={{ fontSize: FONT_SIZE_LG, color: actionMeta.cancel.color }}>
                                        {actionMeta.cancel.label}
                                    </TextX>
                                </Pressable>
                            </View>
                            <View className="flex-1 items-center">
                                <TextX variant="title" className="text-base font-medium">
                                    {selectedCount === 0 ? '选择项目' : `已选择 ${selectedCount} 项`}
                                </TextX>
                            </View>
                            <View className="flex-1 items-end">
                                <Pressable
                                    disabled={actionMeta.selectAll.disabled}
                                    onPress={() => onAction?.('selectAll')}
                                    className="justify-center rounded-full px-2"
                                    style={{ height: BUTTON_HEIGHT_LG }}>
                                    <TextX
                                        className={actionMeta.selectAll.disabled ? 'opacity-50' : ''}
                                        style={{ fontSize: FONT_SIZE_LG, color: actionMeta.selectAll.color }}>
                                        {actionMeta.selectAll.label}
                                    </TextX>
                                </Pressable>
                            </View>
                        </>
                    ) : (
                        <>
                            <View className="flex-1">{left}</View>
                            <View className="flex-row items-center gap-x-2">{right}</View>
                        </>
                    )}
                </View>
            </View>

            {isSelectionMode && bottomActions.length > 0 ? (
                <View
                    className="absolute bottom-0 left-0 right-0 z-50 px-4 pt-2"
                    style={{ backgroundColor: cardColor, paddingBottom: insets.bottom + 8 }}>
                    <View className="flex-row items-center gap-x-2">
                        {bottomActions.map(action => {
                            const meta = actionMeta[action];
                            const Icon = meta.icon;
                            return (
                                <View key={action} className="flex-1 items-center">
                                    <Pressable
                                        disabled={meta.disabled}
                                        onPress={() => onAction?.(action)}
                                        className="flex-col items-center justify-center gap-y-1.5 rounded-full px-2"
                                        style={{ height: BUTTON_HEIGHT_LG }}>
                                        <Icon size={BUTTON_ICON_LG} color={meta.color} />
                                        <TextX
                                            className={meta.disabled ? 'opacity-50' : ''}
                                            style={{ fontSize: FONT_SIZE, color: meta.color }}>
                                            {meta.label}
                                        </TextX>
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>
                </View>
            ) : null}
        </>
    );
}
