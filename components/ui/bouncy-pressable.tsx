import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type BouncyPressableProps = Omit<PressableProps, 'children' | 'style'> & {
    children: ReactNode;
    scaleIn?: number;
    style?: PressableProps['style'];
    contentStyle?: StyleProp<ViewStyle>;
};

export const BouncyPressable = forwardRef<ComponentRef<typeof Pressable>, BouncyPressableProps>(
    ({ children, scaleIn = 1.06, style, contentStyle, onPressIn, onPressOut, disabled, ...props }, ref) => {
        const scale = useSharedValue(1);

        const animatedStyle = useAnimatedStyle(() => {
            return {
                transform: [{ scale: scale.value }],
                opacity: disabled ? 0.5 : 1,
            };
        }, [disabled]);

        const handlePressIn: PressableProps['onPressIn'] = event => {
            scale.value = withSpring(scaleIn, {
                damping: 14,
                stiffness: 420,
                mass: 0.6,
            });
            onPressIn?.(event);
        };

        const handlePressOut: PressableProps['onPressOut'] = event => {
            scale.value = withSpring(1, {
                damping: 18,
                stiffness: 420,
                mass: 0.7,
            });
            onPressOut?.(event);
        };

        return (
            <Pressable ref={ref} style={style} onPressIn={handlePressIn} onPressOut={handlePressOut} disabled={disabled} {...props}>
                <Animated.View style={[animatedStyle, contentStyle]}>{children}</Animated.View>
            </Pressable>
        );
    },
);

BouncyPressable.displayName = 'BouncyPressable';
