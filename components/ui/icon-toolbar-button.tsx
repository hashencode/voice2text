import classNames from 'classnames';
import React from 'react';
import { Pressable } from 'react-native';

type IconToolbarButtonProps = {
    onPress: () => void;
    backgroundColor: string;
    disabled?: boolean;
    className?: string;
    children: React.ReactNode;
};

export function IconToolbarButton({ onPress, backgroundColor, disabled = false, className, children }: IconToolbarButtonProps) {
    return (
        <Pressable
            className={classNames('h-9 min-w-9 items-center justify-center rounded-xl', disabled && 'opacity-50', className)}
            style={{ backgroundColor }}
            disabled={disabled}
            onPress={onPress}>
            {children}
        </Pressable>
    );
}
