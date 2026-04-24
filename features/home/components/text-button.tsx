import React from 'react';
import { Pressable } from 'react-native';
import { TextX } from '~/components/ui/textx';
import { BUTTON_HEIGHT_LG } from '~/theme/globals';

type TextButtonProps = {
    text: string;
    color: string;
    disabled?: boolean;
    onPress?: () => void;
};

export default function TextButton({ text, color, disabled = false, onPress }: TextButtonProps) {
    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            className="justify-center rounded-full px-2"
            style={{ height: BUTTON_HEIGHT_LG }}>
            <TextX className={disabled ? 'opacity-50' : ''} style={{ color }}>
                {text}
            </TextX>
        </Pressable>
    );
}
