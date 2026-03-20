import { useColor } from '@/hooks/useColor';
import {
    FONT_SIZE,
    FONT_SIZE_LG,
    FONT_SIZE_SM,
    FONT_SIZE_XL,
    FONT_SIZE_XXL,
    LINE_HEIGHT,
    LINE_HEIGHT_SIZE_LG,
    LINE_HEIGHT_SIZE_SM,
    LINE_HEIGHT_SIZE_XL,
    LINE_HEIGHT_SIZE_XXL,
} from '@/theme/globals';
import { isNil } from 'lodash';
import React, { forwardRef } from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { Colors } from '~/theme/colors';

type TextVariant = 'body' | 'title' | 'subtitle' | 'heading' | 'description';

interface TextProps extends RNTextProps {
    variant?: TextVariant;
    lightColor?: string;
    darkColor?: string;
    children: React.ReactNode;
}

export const TextX = forwardRef<RNText, TextProps>(
    ({ variant = 'body', lightColor, darkColor, style, children, className = '', ...props }, ref) => {
        if (variant === 'description') {
            if (isNil(lightColor)) {
                lightColor = Colors.light.textMuted;
            }
            if (isNil(darkColor)) {
                darkColor = Colors.dark.textMuted;
            }
        }

        const textColor = useColor('text', { light: lightColor, dark: darkColor });

        const getTextStyle = (): TextStyle => {
            const baseStyle: TextStyle = { color: textColor };

            switch (variant) {
                case 'heading':
                    return { ...baseStyle, fontSize: FONT_SIZE_XXL, lineHeight: LINE_HEIGHT_SIZE_XXL, fontWeight: '600' };

                case 'title':
                    return { ...baseStyle, fontSize: FONT_SIZE_XL, lineHeight: LINE_HEIGHT_SIZE_XL, fontWeight: '600' };

                case 'subtitle':
                    return { ...baseStyle, fontSize: FONT_SIZE_LG, lineHeight: LINE_HEIGHT_SIZE_LG, fontWeight: '500' };

                case 'description':
                    return { ...baseStyle, fontSize: FONT_SIZE_SM, lineHeight: LINE_HEIGHT_SIZE_SM };

                default:
                    return { ...baseStyle, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT };
            }
        };

        return (
            <RNText ref={ref} style={[getTextStyle(), style]} className={className} {...props}>
                {children}
            </RNText>
        );
    },
);
