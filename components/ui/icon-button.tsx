import classNames from 'classnames';
import { LucideProps } from 'lucide-react-native';
import React from 'react';
import { Pressable } from 'react-native';
import { Icon } from '~/components/ui/icon';
import { useColor } from '~/hooks/useColor';
import { BUTTON_HEIGHT, BUTTON_HEIGHT_LG, BUTTON_HEIGHT_SM, BUTTON_ICON, BUTTON_ICON_LG, BUTTON_ICON_SM } from '~/theme/globals';

export type IconButtonSize = 'sm' | 'default' | 'lg';

const SIZE_STYLE_MAP: Record<IconButtonSize, { height: number; width: number }> = {
    sm: { height: BUTTON_HEIGHT_SM, width: BUTTON_HEIGHT_SM },
    default: { height: BUTTON_HEIGHT, width: BUTTON_HEIGHT },
    lg: { height: BUTTON_HEIGHT_LG, width: BUTTON_HEIGHT_LG },
};

const ICON_SIZE_MAP = {
    sm: BUTTON_ICON_SM,
    default: BUTTON_ICON,
    lg: BUTTON_ICON_LG,
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
                { '!rounded-full': circular, 'opacity-50': disabled },
                className,
            )}
            style={[SIZE_STYLE_MAP[size], { backgroundColor: backgroundColor || mutedColor }]}>
            {icon ? <Icon name={icon} size={ICON_SIZE_MAP[size]} {...iconVisualProps} /> : children}
        </Pressable>
    );
}
