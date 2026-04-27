import { TextX } from '@/components/ui/textx';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/use-color';
import { BORDER_RADIUS } from '@/theme/globals';
import { Check } from 'lucide-react-native';
import React from 'react';
import { TextStyle, Pressable } from 'react-native';

interface CheckboxProps {
    checked: boolean;
    label?: string;
    error?: string;
    disabled?: boolean;
    labelStyle?: TextStyle;
    onCheckedChange: (checked: boolean) => void;
}

export function Checkbox({ checked, error, disabled = false, label, labelStyle, onCheckedChange }: CheckboxProps) {
    const primary = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');
    const danger = useColor('red');
    const borderColor = useColor('border');

    return (
        <Pressable
            className="flex-row items-center py-1"
            style={{ opacity: disabled ? 0.5 : 1 }}
            onPress={() => !disabled && onCheckedChange(!checked)}
            disabled={disabled}>
            <View
                style={{
                    width: BORDER_RADIUS,
                    height: BORDER_RADIUS,
                    borderRadius: BORDER_RADIUS,
                    borderWidth: 1.5,
                    borderColor: checked ? primary : borderColor,
                    backgroundColor: checked ? primary : 'transparent',
                    marginRight: label ? 8 : 0,
                }}
                className="items-center justify-center">
                {checked && <Check size={16} color={primaryForegroundColor} strokeWidth={3} strokeLinecap="round" />}
            </View>
            {label && (
                <TextX
                    variant="body"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                        {
                            color: error ? danger : primary,
                        },
                        labelStyle,
                    ]}
                    pointerEvents="none">
                    {label}
                </TextX>
            )}
        </Pressable>
    );
}
