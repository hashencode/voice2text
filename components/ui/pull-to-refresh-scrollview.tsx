import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder, ScrollView, ScrollViewProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type PullToRefreshScrollViewProps = ScrollViewProps & {
    refreshing: boolean;
    onRefresh: () => void;
    maxPullHeight?: number;
    refreshBackgroundColor?: string;
    containerBackgroundColor?: string;
    onPullProgress?: (progress: number) => void;
    renderPullView?: React.ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
};

const RESTING_RATIO = 0.85;

export function PullToRefreshScrollView({
    refreshing,
    onRefresh,
    maxPullHeight = 120,
    refreshBackgroundColor = '#e6f4ff',
    containerBackgroundColor = 'transparent',
    onPullProgress,
    renderPullView,
    containerStyle,
    children,
    onScroll,
    scrollEventThrottle = 16,
    ...scrollViewProps
}: PullToRefreshScrollViewProps) {
    const scrollOffsetYRef = useRef(0);
    const refreshingRef = useRef(refreshing);
    const pullDownPosition = useSharedValue(0);
    const restingPosition = maxPullHeight * RESTING_RATIO;

    useEffect(() => {
        refreshingRef.current = refreshing;
        pullDownPosition.value = withTiming(refreshing ? restingPosition : 0, { duration: refreshing ? 180 : 280 });
        onPullProgress?.(refreshing ? 1 : 0);
    }, [onPullProgress, pullDownPosition, refreshing, restingPosition]);

    const pullContainerStyle = useAnimatedStyle(() => ({
        height: pullDownPosition.value,
    }));

    const contentTranslateStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: pullDownPosition.value }],
    }));

    const releasePull = useCallback(() => {
        const shouldRefresh = pullDownPosition.value >= restingPosition;
        pullDownPosition.value = withTiming(shouldRefresh ? restingPosition : 0, { duration: 180 });
        onPullProgress?.(shouldRefresh ? 1 : 0);
        if (shouldRefresh && !refreshingRef.current) {
            onRefresh();
        }
    }, [onPullProgress, onRefresh, pullDownPosition, restingPosition]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponderCapture: () => false,
                onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                    const isAtTop = scrollOffsetYRef.current <= 0;
                    const isPullingDown = gestureState.dy > 5;
                    return !refreshingRef.current && isAtTop && isPullingDown;
                },
                onPanResponderMove: (_, gestureState) => {
                    const nextPosition = Math.max(0, Math.min(maxPullHeight, gestureState.dy));
                    pullDownPosition.value = nextPosition;
                    const progress = Math.max(0, Math.min(1, nextPosition / restingPosition));
                    onPullProgress?.(progress);
                },
                onPanResponderRelease: releasePull,
                onPanResponderTerminate: releasePull,
            }),
        [maxPullHeight, onPullProgress, pullDownPosition, releasePull, restingPosition],
    );

    const handleScroll: ScrollViewProps['onScroll'] = event => {
        scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
    };

    return (
        <View style={[styles.root, { backgroundColor: refreshBackgroundColor }, containerStyle]}>
            <Animated.View style={[styles.pullContainer, pullContainerStyle]}>{renderPullView}</Animated.View>
            <Animated.View style={[styles.content, contentTranslateStyle]} {...panResponder.panHandlers}>
                <ScrollView
                    {...scrollViewProps}
                    style={[styles.scroll, { backgroundColor: containerBackgroundColor }, scrollViewProps.style]}
                    scrollEventThrottle={scrollEventThrottle}
                    onScroll={handleScroll}>
                    {children}
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    pullContainer: {
        position: 'absolute',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    content: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
});
