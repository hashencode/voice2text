import classNames from 'classnames';
import { LucideProps } from 'lucide-react-native';
import React from 'react';
import { Pressable } from 'react-native';
import { Icon } from '~/components/ui/icon';

export type IconButtonSize = 'sm' | 'default' | 'lg' | number;

const SIZE_MAP = {
    sm: 20,
    default: 24,
    lg: 28,
} as const;

type IconButtonProps = {
    icon?: React.ComponentType<LucideProps>;
    onPress?: () => void;
    disabled?: boolean;
    size?: IconButtonSize;
    className?: string;
    iconProps?: Omit<LucideProps, 'size'>;
    backgroundColor?: string;
    circular?: boolean;
    children?: React.ReactNode;
};

function resolveSize(size: IconButtonSize) {
    if (typeof size === 'number') {
        return size;
    }
    return SIZE_MAP[size];
}

export function IconButton({
    icon,
    onPress,
    disabled = false,
    size = 'default',
    className,
    iconProps,
    backgroundColor,
    circular = false,
    children,
}: IconButtonProps) {
    const resolvedSize = resolveSize(size);

    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            className={classNames(
                'items-center justify-center rounded-xl',
                { 'rounded-full': circular, 'opacity-50': disabled },
                className,
            )}
            style={{ width: resolvedSize, height: resolvedSize, backgroundColor }}>
            {icon ? <Icon name={icon} size={resolvedSize} strokeWidth={1.5} {...iconProps} /> : children}
        </Pressable>
    );
}
