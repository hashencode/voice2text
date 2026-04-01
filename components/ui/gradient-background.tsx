import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

function clampColor(value: number): number {
    return Math.max(0, Math.min(255, value));
}

function shiftHexColor(hex: string, amount: number): string {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) {
        return hex;
    }

    const r = clampColor(parseInt(normalized.slice(0, 2), 16) + amount);
    const g = clampColor(parseInt(normalized.slice(2, 4), 16) + amount);
    const b = clampColor(parseInt(normalized.slice(4, 6), 16) + amount);
    const toHex = (v: number) => v.toString(16).padStart(2, '0');

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface GradientBackgroundProps {
    baseColor: string;
    style?: StyleProp<ViewStyle>;
    borderRadius?: number;
    fromShift?: number;
    toShift?: number;
    children?: React.ReactNode;
}

export function GradientBackground({
    baseColor,
    style,
    borderRadius,
    fromShift = -16,
    toShift = 22,
    children,
}: GradientBackgroundProps) {
    const colors: [string, string] = [shiftHexColor(baseColor, fromShift), shiftHexColor(baseColor, toShift)];

    return (
        <LinearGradient
            colors={colors}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 1 }}
            style={[
                {
                    ...(borderRadius !== undefined ? { borderRadius } : null),
                },
                style,
            ]}>
            {children}
        </LinearGradient>
    );
}
