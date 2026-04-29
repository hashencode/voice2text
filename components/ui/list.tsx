import classNames from 'classnames';
import { ChevronRight, LucideProps } from 'lucide-react-native';
import React from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import { Icon } from '~/components/ui/icon';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/use-color';

type ListProps = {
    children: React.ReactNode;
    headerLeft?: React.ReactNode;
    headerRight?: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    contentClassName?: string;
    contentStyle?: StyleProp<ViewStyle>;
};

export function List({ children, headerLeft, headerRight, footer, className, contentClassName, contentStyle }: ListProps) {
    return (
        <View className={classNames('gap-y-2', className)}>
            {headerLeft || headerRight ? (
                <View className="flex-row items-center justify-between">
                    <View>{headerLeft}</View>
                    <View>{headerRight}</View>
                </View>
            ) : null}
            <View className={classNames('overflow-hidden rounded-xl', contentClassName)} style={contentStyle}>
                {children}
            </View>
            {footer ? <View>{footer}</View> : null}
        </View>
    );
}

type ListItemProps = PressableProps & {
    icon?: React.ComponentType<LucideProps>;
    iconProps?: Omit<LucideProps, 'size'> & { size?: number };
    title: React.ReactNode;
    rightText?: React.ReactNode;
    showChevron?: boolean;
    titleClassName?: string;
    rightTextClassName?: string;
    rightSlot?: React.ReactNode;
    rowClassName?: string;
    backgroundColor?: string;
    showDivider?: boolean;
    dividerColor?: string;
};

export function ListItem({
    icon,
    iconProps,
    title,
    rightText,
    showChevron = false,
    titleClassName,
    rightTextClassName,
    rightSlot,
    rowClassName,
    backgroundColor,
    showDivider = false,
    dividerColor,
    style: pressableStyle,
    ...pressableProps
}: ListItemProps) {
    const textMutedColor = useColor('textMuted');
    const dividerFallbackColor = useColor('muted');
    const resolvedDividerColor = dividerColor ?? dividerFallbackColor;
    const iconSize = iconProps?.size ?? 24;

    return (
        <Pressable
            className={classNames('flex-row items-center justify-between px-4 py-4', rowClassName)}
            style={[backgroundColor ? { backgroundColor } : null, pressableStyle]}
            {...pressableProps}>
            <View className="flex-1 flex-row items-center gap-x-3">
                {icon ? <Icon name={icon} size={iconSize} strokeWidth={1.8} {...iconProps} /> : null}
                {typeof title === 'string' ? <TextX className={titleClassName}>{title}</TextX> : title}
            </View>

            <View className="flex-row items-center gap-x-1">
                {rightSlot ? (
                    rightSlot
                ) : (
                    <>
                        {rightText !== undefined && rightText !== null ? (
                            typeof rightText === 'string' || typeof rightText === 'number' ? (
                                <TextX className={rightTextClassName} style={{ color: textMutedColor }}>
                                    {rightText}
                                </TextX>
                            ) : (
                                rightText
                            )
                        ) : null}
                        {showChevron ? <ChevronRight size={22} color={textMutedColor} /> : null}
                    </>
                )}
            </View>

            {showDivider ? <View className="absolute bottom-0 left-16 right-4 h-px" style={{ backgroundColor: resolvedDividerColor }} /> : null}
        </Pressable>
    );
}
