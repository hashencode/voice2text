import React from 'react';
import { Modal, Pressable, StyleSheet, type ModalProps, type StyleProp, type ViewStyle, View } from 'react-native';
import Animated, { useAnimatedStyle, type AnimatedStyle, type SharedValue } from 'react-native-reanimated';

type ModalMaskProps = {
    isVisible: boolean;
    onPressMask: () => void;
    maskColor?: string;
    maskOpacity?: number;
    maskOpacitySV?: SharedValue<number>;
    maskAnimatedStyle?: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>;
    renderMask?: (params: { onPressMask: () => void; defaultMask: React.ReactNode }) => React.ReactNode;
    animationType?: ModalProps['animationType'];
    statusBarTranslucent?: boolean;
    children?: React.ReactNode;
};

export function ModalMask({
    isVisible,
    onPressMask,
    maskColor = 'rgba(0, 0, 0, 0.18)',
    maskOpacity = 1,
    maskOpacitySV,
    maskAnimatedStyle,
    renderMask,
    animationType = 'none',
    statusBarTranslucent = true,
    children,
}: ModalMaskProps) {
    const sharedOpacityStyle = useAnimatedStyle(() => ({
        opacity: maskOpacitySV ? maskOpacitySV.value : 1,
    }), [maskOpacitySV]);
    const defaultMask = (
        <>
            <Animated.View
                style={[
                    styles.mask,
                    { backgroundColor: maskColor, opacity: maskOpacity },
                    maskOpacitySV ? sharedOpacityStyle : null,
                    maskAnimatedStyle,
                ]}
            />
            <Pressable style={StyleSheet.absoluteFill} onPress={onPressMask} />
        </>
    );
    const maskNode = renderMask ? renderMask({ onPressMask, defaultMask }) : defaultMask;

    return (
        <Modal
            transparent
            statusBarTranslucent={statusBarTranslucent}
            animationType={animationType}
            visible={isVisible}
            onRequestClose={onPressMask}>
            <View style={styles.container}>
                {maskNode}
                <View style={styles.contentLayer} pointerEvents="box-none">
                    {children}
                </View>
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
