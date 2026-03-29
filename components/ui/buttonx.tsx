import { Icon } from '@/components/ui/icon';
import { ButtonSpinner, SpinnerVariant } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import {
    BUTTON_HEIGHT,
    BUTTON_HEIGHT_LG,
    BUTTON_HEIGHT_SM,
    BUTTON_ICON,
    BUTTON_ICON_LG,
    BUTTON_ICON_SM,
    BUTTON_PADDING_HORIZON,
    BUTTON_PADDING_HORIZON_LG,
    BUTTON_PADDING_HORIZON_SM,
    CORNERS,
    FONT_SIZE,
    FONT_SIZE_LG,
    FONT_SIZE_SM,
} from '@/theme/globals';
import * as Haptics from 'expo-haptics';
import { LucideProps } from 'lucide-react-native';
import { forwardRef } from 'react';
import { Pressable, TextStyle, TouchableOpacity, TouchableOpacityProps, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { TextX } from '~/components/ui/textx';

export type ButtonVariant = 'default' | 'text' | 'primary' | 'destructive' | 'success' | 'outline' | 'secondary' | 'ghost' | 'link';

export type ButtonSize = 'default' | 'sm' | 'lg';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
    label?: string;
    children?: React.ReactNode;
    animation?: boolean;
    haptic?: boolean;
    icon?: React.ComponentType<LucideProps>;
    iconProps?: LucideProps;
    onPress?: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    loadingVariant?: SpinnerVariant;
    style?: ViewStyle | ViewStyle[];
    textStyle?: TextStyle;
}

export const ButtonX = forwardRef<View, ButtonProps>(
    (
        {
            children,
            icon,
            iconProps,
            onPress,
            variant = 'default',
            size = 'default',
            disabled = false,
            loading = false,
            animation = true,
            haptic = true,
            loadingVariant = 'default',
            style,
            textStyle,
            ...props
        },
        ref,
    ) => {
        const defaultColor = useColor('card');
        const defaultTextColor = useColor('text');
        const primaryColor = useColor('primary');
        const primaryForegroundColor = useColor('primaryForeground');
        const secondaryColor = useColor('secondary');
        const secondaryForegroundColor = useColor('secondaryForeground');
        const destructiveColor = useColor('red');
        const destructiveForegroundColor = useColor('destructiveForeground');
        const greenColor = useColor('green');
        const borderColor = useColor('border');
        const textColor = useColor('text');
        const outlineColor = useColor('text', { reverse: true });
        const hasStringChildren = typeof children === 'string' && children.trim().length > 0;
        const hasNodeChildren =
            children !== undefined && children !== null && !(typeof children === 'string' && children.trim().length === 0);
        const isIconOnly = Boolean(icon) && !hasNodeChildren;

        // Animation values for liquid glass effect
        const scale = useSharedValue(1);
        const brightness = useSharedValue(1);

        const getButtonStyle = (): ViewStyle => {
            const baseStyle: ViewStyle = {
                borderRadius: CORNERS,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
            };

            // Size variants
            switch (size) {
                case 'sm':
                    Object.assign(baseStyle, { height: BUTTON_HEIGHT_SM, paddingHorizontal: BUTTON_PADDING_HORIZON_SM });
                    break;
                case 'lg':
                    Object.assign(baseStyle, { height: BUTTON_HEIGHT_LG, paddingHorizontal: BUTTON_PADDING_HORIZON_LG });
                    break;
                default:
                    Object.assign(baseStyle, { height: BUTTON_HEIGHT, paddingHorizontal: BUTTON_PADDING_HORIZON });
            }

            if (isIconOnly) {
                const edge = size === 'sm' ? BUTTON_HEIGHT_SM : size === 'lg' ? BUTTON_HEIGHT_LG : BUTTON_HEIGHT;
                Object.assign(baseStyle, {
                    width: edge,
                    paddingHorizontal: 0,
                });
            }

            // Variant styles
            switch (variant) {
                case 'text':
                    return { ...baseStyle, backgroundColor: 'transparent' };
                case 'primary':
                    return { ...baseStyle, backgroundColor: primaryColor };
                case 'destructive':
                    return { ...baseStyle, backgroundColor: destructiveColor };
                case 'success':
                    return { ...baseStyle, backgroundColor: greenColor };
                case 'outline':
                    return {
                        ...baseStyle,
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor,
                    };
                case 'secondary':
                    return { ...baseStyle, backgroundColor: secondaryColor };
                case 'ghost':
                    return {
                        ...baseStyle,
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: outlineColor,
                    };
                case 'link':
                    return {
                        ...baseStyle,
                        backgroundColor: 'transparent',
                        height: 'auto',
                        paddingHorizontal: 0,
                    };
                default:
                    return { ...baseStyle, backgroundColor: defaultColor, borderWidth: 1, borderColor };
            }
        };

        const getButtonTextStyle = (): TextStyle => {
            let fontSize = FONT_SIZE;
            let fontWeight: '400' | '500' = '500';
            switch (size) {
                case 'sm':
                    fontSize = FONT_SIZE_SM;
                    fontWeight = '400';
                    break;
                case 'lg':
                    fontSize = FONT_SIZE_LG;
                    break;
            }

            const baseTextStyle: TextStyle = {
                fontSize,
                fontWeight: fontWeight,
            };

            switch (variant) {
                case 'text':
                    return { ...baseTextStyle, color: defaultTextColor };
                case 'primary':
                    return { ...baseTextStyle, color: primaryForegroundColor };
                case 'destructive':
                    return { ...baseTextStyle, color: destructiveForegroundColor };
                case 'success':
                    return { ...baseTextStyle, color: destructiveForegroundColor };
                case 'outline':
                    return { ...baseTextStyle, color: textColor };
                case 'secondary':
                    return { ...baseTextStyle, color: secondaryForegroundColor };
                case 'ghost':
                    return { ...baseTextStyle, color: outlineColor };
                case 'link':
                    return {
                        ...baseTextStyle,
                        color: primaryColor,
                        textDecorationLine: 'underline',
                    };
                default:
                    return { ...baseTextStyle, color: defaultTextColor };
            }
        };

        const getColor = (): string => {
            switch (variant) {
                case 'text':
                    return defaultTextColor;
                case 'primary':
                    return primaryForegroundColor;
                case 'destructive':
                    return destructiveForegroundColor;
                case 'success':
                    return destructiveForegroundColor;
                case 'outline':
                    return textColor;
                case 'secondary':
                    return secondaryForegroundColor;
                case 'ghost':
                    return outlineColor;
                case 'link':
                    return primaryColor;
                default:
                    return defaultTextColor;
            }
        };

        // Helper function to get icon size based on button size
        const getIconSize = (): number => {
            switch (size) {
                case 'sm':
                    return BUTTON_ICON_SM;
                case 'lg':
                    return BUTTON_ICON_LG;
                default:
                    return BUTTON_ICON;
            }
        };

        // Trigger haptic feedback
        const triggerHapticFeedback = () => {
            if (haptic && !disabled && !loading) {
                if (process.env.EXPO_OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
            }
        };

        // Improved animation handlers for liquid glass effect
        const handlePressIn = (ev?: any) => {
            'worklet';
            // Trigger haptic feedback
            triggerHapticFeedback();

            // Scale up with bouncy spring animation
            scale.value = withSpring(1.05, {
                damping: 15,
                stiffness: 400,
                mass: 0.5,
            });

            // Slight brightness increase for glass effect
            brightness.value = withSpring(1.1, {
                damping: 20,
                stiffness: 300,
            });

            // Call original onPressIn if provided
            props.onPressIn?.(ev);
        };

        const handlePressOut = (ev?: any) => {
            'worklet';
            // Return to original size with smooth spring
            scale.value = withSpring(1, {
                damping: 20,
                stiffness: 400,
                mass: 0.8,
                overshootClamping: false,
            });

            // Return brightness to normal
            brightness.value = withSpring(1, {
                damping: 20,
                stiffness: 300,
            });

            // Call original onPressOut if provided
            props.onPressOut?.(ev);
        };

        // Handle actual press action
        const handlePress = () => {
            if (onPress && !disabled && !loading) {
                onPress();
            }
        };

        // Handle press for TouchableOpacity (non-animated version)
        const handleTouchablePress = () => {
            triggerHapticFeedback();
            handlePress();
        };

        // Animated styles using useAnimatedStyle
        const animatedStyle = useAnimatedStyle(() => {
            return {
                transform: [{ scale: scale.value }],
                opacity: brightness.value * (disabled ? 0.5 : 1),
            };
        });

        // Extract flex value from style prop
        const getFlexFromStyle = () => {
            if (!style) return null;

            const styleArray = Array.isArray(style) ? style : [style];

            // Find the last occurrence of flex (in case of multiple styles with flex)
            for (let i = styleArray.length - 1; i >= 0; i--) {
                const s = styleArray[i];
                if (s && typeof s === 'object' && 'flex' in s) {
                    return s.flex;
                }
            }
            return null;
        };

        // Alternative simpler solution - replace flex with alignSelf
        const getPressableStyle = (): ViewStyle => {
            const flexValue = getFlexFromStyle();
            // If flex: 1 is applied, use alignSelf: 'stretch' instead to only affect width
            return flexValue === 1
                ? {
                      flex: 1,
                      alignSelf: 'stretch',
                  }
                : flexValue !== null
                  ? {
                        flex: flexValue,
                        maxHeight: size === 'sm' ? BUTTON_HEIGHT_SM : size === 'lg' ? BUTTON_HEIGHT_LG : BUTTON_HEIGHT,
                    }
                  : {};
        };

        // Updated getStyleWithoutFlex function
        const getStyleWithoutFlex = () => {
            if (!style) return style;

            const styleArray = Array.isArray(style) ? style : [style];
            return styleArray.map(s => {
                if (s && typeof s === 'object' && 'flex' in s) {
                    const { flex, ...restStyle } = s;
                    return restStyle;
                }
                return s;
            });
        };

        const buttonStyle = getButtonStyle();
        const finalTextStyle = getButtonTextStyle();
        const contentColor = getColor();
        const iconSize = getIconSize();
        const styleWithoutFlex = getStyleWithoutFlex();
        const formatTwoCjkChars = (label: string): string => {
            const trimmed = label.trim();
            if (/^[\u4E00-\u9FFF]{2}$/.test(trimmed)) {
                return `${trimmed[0]} ${trimmed[1]}`;
            }
            return label;
        };
        const displayLabel = hasStringChildren ? formatTwoCjkChars(children) : null;

        return animation ? (
            <Pressable
                ref={ref}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                style={getPressableStyle()}
                {...props}>
                <Animated.View style={[animatedStyle, buttonStyle, styleWithoutFlex]}>
                    {loading ? (
                        <ButtonSpinner size={size} variant={loadingVariant} color={contentColor} />
                    ) : hasStringChildren ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {icon && <Icon name={icon} color={contentColor} size={iconSize} {...iconProps} />}
                            <TextX style={[finalTextStyle, textStyle]}>{displayLabel}</TextX>
                        </View>
                    ) : isIconOnly ? (
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name={icon!} color={contentColor} size={iconSize} {...iconProps} />
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {icon && <Icon name={icon} color={contentColor} size={iconSize} {...iconProps} />}
                            {children}
                        </View>
                    )}
                </Animated.View>
            </Pressable>
        ) : (
            <TouchableOpacity
                ref={ref}
                style={[buttonStyle, disabled && { opacity: 0.5 }, styleWithoutFlex]}
                onPress={handleTouchablePress}
                disabled={disabled || loading}
                activeOpacity={0.8}
                {...props}>
                {loading ? (
                    <ButtonSpinner size={size} variant={loadingVariant} color={contentColor} />
                ) : hasStringChildren ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {icon && <Icon name={icon} color={contentColor} size={iconSize} {...iconProps} />}
                        <TextX style={[finalTextStyle, textStyle]}>{displayLabel}</TextX>
                    </View>
                ) : isIconOnly ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={icon!} color={contentColor} size={iconSize} {...iconProps} />
                    </View>
                ) : (
                    children
                )}
            </TouchableOpacity>
        );
    },
);

// Add display name for better debugging
ButtonX.displayName = 'ButtonX';
