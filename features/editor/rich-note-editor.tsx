import {
    Bold,
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
import { Pressable, ScrollView, View } from 'react-native';
import { EnrichedTextInput, type EnrichedTextInputInstance, type OnChangeStateEvent } from 'react-native-enriched';
import { useToast } from '~/components/ui/toast';
import { useColor } from '~/hooks/useColor';
import { useKeyboardHeight } from '~/hooks/useKeyboardHeight';
import { FONT_SIZE } from '~/theme/globals';

type ToolbarStateKey = keyof OnChangeStateEvent;
const TOOLBAR_ICON_SIZE = 20;

type Props = {
    placeholder?: string;
};

export default function RichNoteEditor({ placeholder = '编辑备注' }: Props) {
    const [noteText, setNoteText] = React.useState('');
    const [noteStyleState, setNoteStyleState] = React.useState<OnChangeStateEvent | null>(null);
    const [isNoteFocused, setIsNoteFocused] = React.useState(false);
    const noteInputRef = React.useRef<EnrichedTextInputInstance | null>(null);
    const isToolbarPressingRef = React.useRef(false);

    const { keyboardHeight, isKeyboardVisible } = useKeyboardHeight();
    const { toast } = useToast();
    const primaryColor = useColor('primary');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const mutedColor = useColor('muted');

    const focusNoteInput = React.useCallback(() => {
        requestAnimationFrame(() => {
            noteInputRef.current?.focus?.();
        });
    }, []);

    const applyEditorAction = React.useCallback(
        (action: () => void) => {
            action();
            if (!isNoteFocused) {
                focusNoteInput();
            }
        },
        [focusNoteInput, isNoteFocused],
    );

    const showKeyboardToolbar = isKeyboardVisible && isNoteFocused;
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
    }, [applyEditorAction, isHeadingActive, noteStyleState]);

    return (
        <View className="flex-1">
            <EnrichedTextInput
                ref={noteInputRef}
                onFocus={() => setIsNoteFocused(true)}
                onBlur={() => {
                    if (isToolbarPressingRef.current) {
                        return;
                    }
                    setIsNoteFocused(false);
                }}
                onChangeText={event => setNoteText(event.nativeEvent.value)}
                onChangeState={event => setNoteStyleState(event.nativeEvent)}
                style={{
                    flex: 1,
                    fontSize: FONT_SIZE,
                    color: textColor,
                }}
                placeholder={placeholder}
                placeholderTextColor={mutedTextColor}
                selectionColor="rgba(0,0,0,0.1)"
                defaultValue={noteText}
                htmlStyle={{
                    a: { color: primaryColor, textDecorationLine: 'underline' },
                    code: { color: textColor, backgroundColor: mutedColor },
                    h1: { fontSize: 20, bold: true },
                    ul: { marginLeft: 10, gapWidth: 6 },
                    ulCheckbox: { marginLeft: 10, gapWidth: 6 },
                }}
            />

            {showKeyboardToolbar ? (
                <View
                    className="absolute left-0 right-0 px-3 py-2"
                    style={{
                        bottom: keyboardHeight,
                        backgroundColor: mutedColor,
                    }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                        {toolbarItems.map(item => {
                            const IconComp = item.icon;
                            return (
                                <Pressable
                                    key={item.key}
                                    onPressIn={() => {
                                        isToolbarPressingRef.current = true;
                                    }}
                                    onPressOut={() => {
                                        requestAnimationFrame(() => {
                                            isToolbarPressingRef.current = false;
                                        });
                                    }}
                                    onPress={() => {
                                        if (item.blocked) {
                                            toast({
                                                title: '当前标题样式下不可用',
                                                description: '请先取消标题样式后再使用该格式',
                                                variant: 'error',
                                                duration: 2200,
                                            });
                                            return;
                                        }
                                        item.onPress();
                                    }}
                                    hitSlop={8}>
                                    <View
                                        className="h-[34px] w-[34px] items-center justify-center rounded-lg"
                                        style={{ opacity: item.blocked ? 0.35 : 1 }}>
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
            ) : null}
        </View>
    );
}
