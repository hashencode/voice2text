import type { ButtonProps } from '@/components/ui/buttonx';
import { ButtonX } from '@/components/ui/buttonx';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ModalMask } from '@/components/ui/modal-mask';
import { useColor } from '@/hooks/useColor';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import React, { useEffect } from 'react';
import { LayoutChangeEvent, StyleSheet, useWindowDimensions, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { TextX } from '~/components/ui/textx';

export type AlertDialogProps = {
    isVisible: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    confirmButtonProps?: Omit<ButtonProps, 'onPress' | 'children'>;
    cancelButtonProps?: Omit<ButtonProps, 'onPress' | 'children'>;
    onConfirm?: () => boolean | void | Promise<boolean | void>;
    onCancel?: () => void;
    dismissible?: boolean;
    showCancelButton?: boolean;
    style?: ViewStyle;
};

// A simple card-like dialog overlay with fade-in animation similar to BottomSheet's backdrop
export function AlertDialog({
    isVisible,
    onClose,
    title,
    description,
    children,
    confirmText = 'OK',
    cancelText = 'Cancel',
    confirmButtonProps,
    cancelButtonProps,
    onConfirm,
    onCancel,
    dismissible = true,
    showCancelButton = true,
    style,
}: AlertDialogProps) {
    const cardColor = useColor('card');
    const { height: windowHeight } = useWindowDimensions();
    const { keyboardHeight, isKeyboardVisible, keyboardAnimationDuration } = useKeyboardHeight();

    const [dialogLayout, setDialogLayout] = React.useState<{ y: number; height: number } | null>(null);
    const cardTranslateY = useSharedValue(0);

    useEffect(() => {
        if (!isVisible) {
            cardTranslateY.value = withTiming(0, { duration: 200 });
        }
    }, [cardTranslateY, isVisible]);

    useEffect(() => {
        if (!isVisible || !dialogLayout) {
            cardTranslateY.value = withTiming(0, { duration: 180 });
            return;
        }

        const keyboardTop = windowHeight - keyboardHeight;
        const dialogBottom = dialogLayout.y + dialogLayout.height;
        const safeGap = 16;
        const overlap = dialogBottom + safeGap - keyboardTop;
        const targetTranslateY = isKeyboardVisible && overlap > 0 ? -overlap : 0;
        const duration = keyboardAnimationDuration > 0 ? keyboardAnimationDuration : 220;

        cardTranslateY.value = withTiming(targetTranslateY, { duration });
    }, [cardTranslateY, dialogLayout, isKeyboardVisible, isVisible, keyboardAnimationDuration, keyboardHeight, windowHeight]);

    const rCardWrapperStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: cardTranslateY.value }],
    }));

    const handleBackdropPress = () => {
        if (dismissible) {
            onClose();
            if (onCancel) onCancel();
        }
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        onClose();
    };

    const handleConfirm = async () => {
        if (!onConfirm) {
            onClose();
            return;
        }

        try {
            const shouldClose = await onConfirm();
            if (shouldClose === false) {
                return;
            }
            onClose();
        } catch {
            // Keep dialog open when confirm action fails.
        }
    };

    const handleDialogLayout = (event: LayoutChangeEvent) => {
        const { y, height } = event.nativeEvent.layout;
        setDialogLayout(prev => {
            if (prev && prev.y === y && prev.height === height) {
                return prev;
            }
            return { y, height };
        });
    };

    return (
        <ModalMask isVisible={isVisible} onPressMask={handleBackdropPress} statusBarTranslucent contentTransitionPreset="scale">
            <Animated.View style={styles.contentContainer} pointerEvents="box-none">
                <Animated.View
                    onLayout={handleDialogLayout}
                    style={[styles.roundedWrapper, rCardWrapperStyle, { backgroundColor: cardColor }, style]}>
                    <Card
                        // Card has no rounded corners, background or shadow (delegated to wrapper)
                        style={{ backgroundColor: 'transparent', elevation: 0 }}>
                        {(title || description) && (
                            <CardHeader>
                                {title ? <CardTitle>{title}</CardTitle> : null}
                                {description ? <TextX variant="description">{description}</TextX> : null}
                            </CardHeader>
                        )}
                        {children ? <CardContent>{children}</CardContent> : null}
                        <CardFooter>
                            {showCancelButton && (
                                <ButtonX variant="secondary" className="flex-grow" size="lg" onPress={handleCancel} {...cancelButtonProps}>
                                    {cancelText}
                                </ButtonX>
                            )}
                            <ButtonX variant="primary" className="flex-grow" size="lg" onPress={handleConfirm} {...confirmButtonProps}>
                                {confirmText}
                            </ButtonX>
                        </CardFooter>
                    </Card>
                </Animated.View>
            </Animated.View>
        </ModalMask>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    roundedWrapper: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
    },
});

export function useAlertDialog() {
    const [isVisible, setIsVisible] = React.useState(false);
    const open = React.useCallback(() => setIsVisible(true), []);
    const close = React.useCallback(() => setIsVisible(false), []);
    const toggle = React.useCallback(() => setIsVisible(v => !v), []);
    return { isVisible, open, close, toggle };
}
