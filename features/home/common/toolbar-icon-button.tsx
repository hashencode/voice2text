import classNames from 'classnames';
import React from 'react';
import { Pressable } from 'react-native';

type ToolbarIconButtonProps = {
    onPress: () => void;
    backgroundColor: string;
    disabled?: boolean;
    className?: string;
    children: React.ReactNode;
};

export default function ToolbarIconButton({ onPress, backgroundColor, disabled = false, className, children }: ToolbarIconButtonProps) {
    return (
        <Pressable
            className={classNames('h-9 w-9 items-center justify-center rounded-xl', disabled && 'opacity-50', className)}
            style={{ backgroundColor }}
            disabled={disabled}
            onPress={onPress}>
            {children}
        </Pressable>
    );
}
