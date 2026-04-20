import React from 'react';
import { View } from 'react-native';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

type StatusIconComponent = React.ComponentType<{
    width?: number;
    height?: number;
    strokeWidth?: number;
    color?: string;
}>;

type SessionTabStatusCardProps = {
    Icon: StatusIconComponent;
    title: string;
    description?: string;
    progressText?: string | null;
    iconColor?: string;
    actions?: React.ReactNode;
    align?: 'center' | 'left';
    iconSize?: number;
};

export function SessionTabStatusCard({
    Icon,
    title,
    description,
    progressText,
    iconColor,
    actions,
    align = 'center',
    iconSize = 52,
}: SessionTabStatusCardProps) {
    const mutedTextColor = useColor('textMuted');
    const resolvedIconColor = iconColor ?? mutedTextColor;
    const isLeftAlign = align === 'left';

    return (
        <View className={`rounded-2xl px-2 py-2 ${isLeftAlign ? '' : 'items-center justify-center px-6 py-5'}`}>
            <View className={`flex-row items-center gap-2 ${isLeftAlign ? '' : 'justify-center'}`}>
                <Icon width={iconSize} height={iconSize} strokeWidth={1.4} color={resolvedIconColor} />
                <TextX className={isLeftAlign ? '' : 'text-center'} style={{ color: mutedTextColor }}>
                    {title}
                </TextX>
            </View>
            {description ? (
                <TextX className={`mt-1 text-xs ${isLeftAlign ? '' : 'text-center'}`} style={{ color: mutedTextColor }}>
                    {description}
                </TextX>
            ) : null}
            {progressText ? (
                <TextX className={`mt-1 text-xs ${isLeftAlign ? '' : 'text-center'}`} style={{ color: mutedTextColor }}>
                    {progressText}
                </TextX>
            ) : null}
            {actions ? <View className={`mt-4 w-full ${isLeftAlign ? '' : 'max-w-xs'}`}>{actions}</View> : null}
        </View>
    );
}
