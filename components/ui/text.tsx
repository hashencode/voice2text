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
        const hasFontSize = /\btext-(xs|sm|base|lg|xl|\d+xl|\[\d)/.test(className);
        const hasLineHeight = /\bleading-(none|tight|snug|normal|relaxed|loose|\d+|\[\d)/.test(className);
        const hasFontWeight = /\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/.test(className);

        const getTextStyle = (): TextStyle => {
            const baseStyle: TextStyle = {};

            if (lightColor || darkColor) {
                baseStyle.color = textColor;
            }

            let fontSize: number | undefined;
            let lineHeight: number | undefined;
            let fontWeight: TextStyle['fontWeight'] | undefined;

            switch (variant) {
                case 'heading':
                    fontSize = FONT_SIZE_LG + 4;
                    lineHeight = 32;
                    fontWeight = '600';
                    break;

                case 'title':
                    fontSize = FONT_SIZE_LG + 2;
                    lineHeight = 28;
                    fontWeight = '600';
                    break;

                case 'subtitle':
                    fontSize = FONT_SIZE_LG;
                    lineHeight = 28;
                    fontWeight = '500';
                    break;

                case 'description':
                    fontSize = FONT_SIZE_SM;
                    lineHeight = 20;
                    break;

                default:
                    fontSize = FONT_SIZE;
                    lineHeight = 24;
            }

            return {
                ...baseStyle,
                ...(hasFontSize ? {} : { fontSize }),
                ...(hasFontSize || hasLineHeight ? {} : { lineHeight }),
                ...(hasFontWeight || !fontWeight ? {} : { fontWeight }),
            };
        };

        return (
            <RNText ref={ref} style={[getTextStyle(), style]} className={className} {...props}>
                {children}
            </RNText>
        );
    },
);
