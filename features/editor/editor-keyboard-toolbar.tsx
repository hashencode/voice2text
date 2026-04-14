import {
    Bold,
    CircleChevronDown,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    List,
    ListOrdered,
    ListTodo,
    Quote,
    Strikethrough,
    Underline,
} from 'lucide-react-native';
import React from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import type { EnrichedTextInputInstance, OnChangeStateEvent } from 'react-native-enriched';
import { ScrollView } from 'react-native-gesture-handler';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';

type ToolbarStateKey = keyof OnChangeStateEvent;
const TOOLBAR_ICON_SIZE = 20;

type Props = {
    visible: boolean;
    noteInputRef: React.RefObject<EnrichedTextInputInstance | null>;
    noteStyleState: OnChangeStateEvent | null;
    primaryColor: string;
    textColor: string;
    mutedColor: string;
    mutedTextColor: string;
    onBlocked: () => void;
};

export default function EditorKeyboardToolbar({
    visible,
    noteInputRef,
    noteStyleState,
    primaryColor,
    textColor,
    mutedColor,
    mutedTextColor,
    onBlocked,
}: Props) {
    const isKeyboardVisible = useKeyboardState(state => state.isVisible);

    const focusInput = React.useCallback(() => {
        requestAnimationFrame(() => {
            noteInputRef.current?.focus?.();
        });
    }, [noteInputRef]);

    const applyEditorAction = React.useCallback(
        (action: () => void) => {
            action();
            focusInput();
        },
        [focusInput],
    );
    const dismissKeyboardAndBlur = React.useCallback(() => {
        noteInputRef.current?.blur?.();
        Keyboard.dismiss();
    }, [noteInputRef]);

    const isHeadingActive = Boolean(
        noteStyleState?.h1.isActive ||
        noteStyleState?.h2.isActive ||
        noteStyleState?.h3.isActive ||
        noteStyleState?.h4.isActive ||
        noteStyleState?.h5.isActive ||
        noteStyleState?.h6.isActive,
    );

    const toolbarItems = React.useMemo(() => {
        const items: {
            key: string;
            stateKey: ToolbarStateKey;
            icon: React.ComponentType<{ size?: number; color?: string }>;
            active: boolean;
            onPress: () => void;
        }[] = [
            {
                key: 'bold',
                stateKey: 'bold',
                icon: Bold,
                active: noteStyleState?.bold.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleBold()),
            },
            {
                key: 'italic',
                stateKey: 'italic',
                icon: Italic,
                active: noteStyleState?.italic.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleItalic()),
            },
            {
                key: 'underline',
                stateKey: 'underline',
                icon: Underline,
                active: noteStyleState?.underline.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleUnderline()),
            },
            {
                key: 'strike',
                stateKey: 'strikeThrough',
                icon: Strikethrough,
                active: noteStyleState?.strikeThrough.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleStrikeThrough()),
            },
            {
                key: 'h1',
                stateKey: 'h1',
                icon: Heading1,
                active: noteStyleState?.h1.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleH1()),
            },
            {
                key: 'h2',
                stateKey: 'h2',
                icon: Heading2,
                active: noteStyleState?.h2.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleH2()),
            },
            {
                key: 'h3',
                stateKey: 'h3',
                icon: Heading3,
                active: noteStyleState?.h3.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleH3()),
            },
            {
                key: 'blockquote',
                stateKey: 'blockQuote',
                icon: Quote,
                active: noteStyleState?.blockQuote.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleBlockQuote()),
            },
            {
                key: 'ol',
                stateKey: 'orderedList',
                icon: ListOrdered,
                active: noteStyleState?.orderedList.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleOrderedList()),
            },
            {
                key: 'ul',
                stateKey: 'unorderedList',
                icon: List,
                active: noteStyleState?.unorderedList.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleUnorderedList()),
            },
            {
                key: 'checkbox',
                stateKey: 'checkboxList',
                icon: ListTodo,
                active: noteStyleState?.checkboxList.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleCheckboxList(false)),
            },
        ];

        return items.map(item => {
            const styleState = noteStyleState?.[item.stateKey];
            return {
                ...item,
                blocked: Boolean(isHeadingActive && styleState?.isBlocking),
            };
        });
    }, [applyEditorAction, isHeadingActive, noteInputRef, noteStyleState]);

    if (!visible || !isKeyboardVisible) {
        return null;
    }

    return (
        <KeyboardStickyView
            pointerEvents="box-none"
            className="absolute bottom-0 left-0 right-0 z-40"
            style={{ elevation: 40 }}>
            <View pointerEvents="auto" style={{ backgroundColor: mutedColor }} className="h-[50px] justify-center px-3">
                <View className="flex-row items-center">
                    <ScrollView
                        horizontal
                        className="h-full flex-1"
                        showsHorizontalScrollIndicator={false}
                        nestedScrollEnabled
                        directionalLockEnabled
                        keyboardShouldPersistTaps="always"
                        contentContainerStyle={{ gap: 16, alignItems: 'center', paddingRight: 12 }}>
                        <Pressable onPress={dismissKeyboardAndBlur} hitSlop={8}>
                            <View className="h-[34px] w-[34px] items-center justify-center rounded-lg">
                                <CircleChevronDown size={TOOLBAR_ICON_SIZE} color={textColor} />
                            </View>
                        </Pressable>
                        {toolbarItems.map(item => {
                            const IconComp = item.icon;
                            return (
                                <Pressable
                                    key={item.key}
                                    onPress={() => {
                                        if (item.blocked) {
                                            onBlocked();
                                            return;
                                        }
                                        item.onPress();
                                    }}
                                    hitSlop={8}>
                                    <View
                                        className={`h-[34px] w-[34px] items-center justify-center rounded-lg ${item.blocked ? 'opacity-[0.35]' : ''}`}>
                                        <IconComp
                                            size={TOOLBAR_ICON_SIZE}
                                            color={item.blocked ? mutedTextColor : item.active ? primaryColor : textColor}
                                        />
                                    </View>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>
        </KeyboardStickyView>
    );
}
