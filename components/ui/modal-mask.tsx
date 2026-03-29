import React from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View, type ModalProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    type AnimatedStyle,
} from 'react-native-reanimated';

type ContentTransitionPreset = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'scale';

const CONTENT_TRANSITION_DURATION_BY_PRESET: Record<ContentTransitionPreset, number> = {
    none: 0,
    fade: 160,
    'slide-up': 260,
    'slide-down': 240,
    'slide-left': 240,
    'slide-right': 240,
    scale: 200,
};

type ModalMaskProps = {
    isVisible: boolean;
    onPressMask: () => void;
    maskColor?: string;
    maskOpacity?: number;
    maskAnimatedStyle?: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>;
    renderMask?: (params: { onPressMask: () => void; defaultMask: React.ReactNode }) => React.ReactNode;
    animationType?: ModalProps['animationType'];
    statusBarTranslucent?: boolean;
    deferUnmountOnHide?: boolean;
    fadeDuration?: number;
    contentFadeDuration?: number;
    contentTransitionPreset?: ContentTransitionPreset;
    contentTransitionDuration?: number;
    contentTransitionDistance?: number;
    contentTransitionScaleFrom?: number;
    contentTransitionEasing?: (value: number) => number;
    children?: React.ReactNode;
};

export function ModalMask({
    isVisible,
    onPressMask,
    maskColor = 'rgba(0, 0, 0, 0.6)',
    maskOpacity = 1,
    maskAnimatedStyle,
    renderMask,
    animationType = 'none',
    statusBarTranslucent = true,
    deferUnmountOnHide = true,
    fadeDuration = 220,
    contentFadeDuration,
    contentTransitionPreset = 'fade',
    contentTransitionDuration,
    contentTransitionDistance,
    contentTransitionScaleFrom = 0.94,
    contentTransitionEasing = Easing.out(Easing.quad),
    children,
}: ModalMaskProps) {
    const screen = Dimensions.get('window');
    const [shouldRender, setShouldRender] = React.useState(isVisible);
    const isVisibleRef = React.useRef(isVisible);
    const internalOpacity = useSharedValue(0);
    const contentProgress = useSharedValue(0);
    const resolvedContentDuration =
        contentTransitionDuration ?? contentFadeDuration ?? CONTENT_TRANSITION_DURATION_BY_PRESET[contentTransitionPreset];
    const resolvedTransitionDistance =
        contentTransitionDistance ??
        (contentTransitionPreset === 'slide-up' || contentTransitionPreset === 'slide-down'
            ? screen.height
            : contentTransitionPreset === 'slide-left' || contentTransitionPreset === 'slide-right'
              ? screen.width
              : 20);

    React.useEffect(() => {
        isVisibleRef.current = isVisible;
    }, [isVisible]);

    const hideAfterAnimation = React.useCallback(() => {
        if (!isVisibleRef.current) {
            setShouldRender(false);
        }
    }, []);

    React.useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
            internalOpacity.value = withTiming(1, { duration: fadeDuration });
            if (contentTransitionPreset === 'none') {
                contentProgress.value = 1;
            } else {
                contentProgress.value = withTiming(1, {
                    duration: resolvedContentDuration,
                    easing: contentTransitionEasing,
                });
            }
            return;
        }

        if (!deferUnmountOnHide) {
            internalOpacity.value = 0;
            contentProgress.value = 0;
            setShouldRender(false);
            return;
        }

        const shouldWaitContentAnimation = contentTransitionPreset !== 'none' && resolvedContentDuration > fadeDuration;
        internalOpacity.value = withTiming(0, { duration: fadeDuration }, finished => {
            if (finished && !shouldWaitContentAnimation) {
                runOnJS(hideAfterAnimation)();
            }
        });
        if (contentTransitionPreset === 'none') {
            contentProgress.value = 0;
        } else {
            contentProgress.value = withTiming(
                0,
                {
                    duration: resolvedContentDuration,
                    easing: Easing.in(Easing.quad),
                },
                finished => {
                    if (finished && shouldWaitContentAnimation) {
                        runOnJS(hideAfterAnimation)();
                    }
                },
            );
        }
    }, [
        contentProgress,
        contentTransitionEasing,
        contentTransitionPreset,
        deferUnmountOnHide,
        fadeDuration,
        hideAfterAnimation,
        internalOpacity,
        isVisible,
        resolvedContentDuration,
    ]);

    const composedOpacityStyle = useAnimatedStyle(
        () => ({
            opacity: maskOpacity * internalOpacity.value,
        }),
        [maskOpacity],
    );
    const contentFadeStyle = useAnimatedStyle(
        () => ({
            opacity: contentTransitionPreset === 'none' ? 1 : interpolate(contentProgress.value, [0, 1], [0, 1]),
            transform: (() => {
                if (contentTransitionPreset === 'slide-up') {
                    return [
                        {
                            translateY: interpolate(contentProgress.value, [0, 1], [resolvedTransitionDistance, 0]),
                        },
                    ];
                }
                if (contentTransitionPreset === 'slide-down') {
                    return [
                        {
                            translateY: interpolate(contentProgress.value, [0, 1], [-resolvedTransitionDistance, 0]),
                        },
                    ];
                }
                if (contentTransitionPreset === 'slide-left') {
                    return [
                        {
                            translateX: interpolate(contentProgress.value, [0, 1], [resolvedTransitionDistance, 0]),
                        },
                    ];
                }
                if (contentTransitionPreset === 'slide-right') {
                    return [
                        {
                            translateX: interpolate(contentProgress.value, [0, 1], [-resolvedTransitionDistance, 0]),
                        },
                    ];
                }
                if (contentTransitionPreset === 'scale') {
                    return [
                        {
                            scale: interpolate(contentProgress.value, [0, 1], [contentTransitionScaleFrom, 1]),
                        },
                    ];
                }
                return [];
            })(),
        }),
        [contentProgress, contentTransitionPreset, resolvedTransitionDistance, contentTransitionScaleFrom],
    );

    if (!shouldRender) {
        return null;
    }

    const defaultMask = (
        <>
            <Animated.View style={[styles.mask, { backgroundColor: maskColor }, composedOpacityStyle, maskAnimatedStyle]} />
            <Pressable style={StyleSheet.absoluteFill} onPress={onPressMask} />
        </>
    );
    const maskNode = renderMask ? renderMask({ onPressMask, defaultMask }) : defaultMask;

    return (
        <Modal
            transparent
            statusBarTranslucent={statusBarTranslucent}
            animationType={animationType}
            visible={shouldRender}
            onRequestClose={onPressMask}>
            <View style={styles.container}>
                {maskNode}
                <Animated.View style={[styles.contentLayer, contentFadeStyle]} pointerEvents="box-none">
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    mask: {
        ...StyleSheet.absoluteFillObject,
    },
    contentLayer: {
        ...StyleSheet.absoluteFillObject,
    },
});
