import classNames from 'classnames';
import { LucideProps } from 'lucide-react-native';
import React from 'react';
import { Pressable } from 'react-native';
import { Icon } from '~/components/ui/icon';
import { useColor } from '~/hooks/useColor';

type IconButtonSize = 'sm' | 'default';

const SIZE_CLASS_MAP: Record<IconButtonSize, string> = {
    sm: 'min-h-9 min-w-9',
    default: 'min-h-12 min-w-12',
};

const ICON_SIZE_MAP = {
    sm: 16,
    default: 20,
};

type IconButtonProps = {
    onPress?: () => void;
    backgroundColor?: string;
    disabled?: boolean;
    active?: boolean;
    size?: IconButtonSize;
    circular?: boolean;
    className?: string;
    icon?: React.ComponentType<LucideProps>;
    iconProps?: LucideProps;
    children?: React.ReactNode;
};

export function IconButton({
    onPress,
    backgroundColor,
    disabled = false,
    active = false,
    size = 'default',
    circular = false,
    className,
    icon,
    iconProps,
    children,
}: IconButtonProps) {
    const mutedColor = useColor('muted');
    const primaryColor = useColor('primary');
    const iconVisualProps = active
        ? {
              ...iconProps,
              color: primaryColor,
          }
        : iconProps;

    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            className={classNames(
                'items-center justify-center rounded-xl',
                SIZE_CLASS_MAP[size],
                { '!rounded-full': circular, 'opacity-50': disabled },
                className,
            )}
            style={{ backgroundColor: backgroundColor || mutedColor }}>
            {icon ? <Icon name={icon} size={ICON_SIZE_MAP[size]} {...iconVisualProps} /> : children}
        </Pressable>
    );
}
