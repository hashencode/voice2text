import { useColor } from '@/hooks/useColor';
import { FONT_SIZE, FONT_SIZE_LG, FONT_SIZE_SM } from '@/theme/globals';
import React, { forwardRef } from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

type TextVariant = 'body' | 'title' | 'subtitle' | 'heading' | 'description';

interface TextProps extends RNTextProps {
    variant?: TextVariant;
    lightColor?: string;
    darkColor?: string;
    children: React.ReactNode;
}

export const TextX = forwardRef<RNText, TextProps>(
    ({ variant = 'body', lightColor, darkColor, style, children, className = '', ...props }, ref) => {
        const textColor = useColor('text', { light: lightColor, dark: darkColor });

        const getTextStyle = (): TextStyle => {
            const baseStyle: TextStyle = { color: textColor };

            switch (variant) {
                case 'heading':
                    return { ...baseStyle, fontSize: FONT_SIZE_LG + 4, lineHeight: 32, fontWeight: '600' };

                case 'title':
                    return { ...baseStyle, fontSize: FONT_SIZE_LG + 2, lineHeight: 28, fontWeight: '600' };

                case 'subtitle':
                    return { ...baseStyle, fontSize: FONT_SIZE_LG, lineHeight: 28, fontWeight: '500' };

                case 'description':
                    return { ...baseStyle, fontSize: FONT_SIZE_SM, lineHeight: 20 };

                default:
                    return { ...baseStyle, fontSize: FONT_SIZE, lineHeight: 24 };
            }
        };

        return (
            <RNText ref={ref} style={[getTextStyle(), style]} className={className} {...props}>
                {children}
            </RNText>
        );
    },
);
