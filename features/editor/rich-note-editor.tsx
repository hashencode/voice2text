import React from 'react';
import { View } from 'react-native';
import { EnrichedTextInput, type EnrichedTextInputInstance, type OnChangeStateEvent } from 'react-native-enriched';
import { useColor } from '~/hooks/useColor';
import { FONT_SIZE_LG } from '~/theme/globals';

type Props = {
    placeholder?: string;
    inputRef: React.RefObject<EnrichedTextInputInstance | null>;
    initialText?: string;
    onTextChange?: (text: string) => void;
    onFocusChange?: (focused: boolean) => void;
    onStyleStateChange?: (state: OnChangeStateEvent | null) => void;
};

export default function RichNoteEditor({
    placeholder = '编辑备注',
    inputRef,
    initialText = '',
    onTextChange,
    onFocusChange,
    onStyleStateChange,
}: Props) {
    const primaryColor = useColor('primary');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const mutedColor = useColor('muted');

    return (
        <View className="flex-1">
            <EnrichedTextInput
                ref={inputRef}
                onFocus={() => onFocusChange?.(true)}
                onBlur={() => onFocusChange?.(false)}
                onChangeText={event => {
                    onTextChange?.(event.nativeEvent.value);
                }}
                onChangeState={event => onStyleStateChange?.(event.nativeEvent)}
                style={{
                    flex: 1,
                    fontSize: FONT_SIZE_LG,
                    color: textColor,
                }}
                placeholder={placeholder}
                placeholderTextColor={mutedTextColor}
                selectionColor="rgba(0,0,0,0.1)"
                defaultValue={initialText}
                htmlStyle={{
                    a: { color: primaryColor, textDecorationLine: 'underline' },
                    code: { color: textColor, backgroundColor: mutedColor },
                    h1: { fontSize: 20, bold: true },
                    ul: { marginLeft: 10, gapWidth: 6 },
                    ulCheckbox: { marginLeft: 10, gapWidth: 6 },
                }}
            />
        </View>
    );
}
