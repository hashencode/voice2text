import { CheckCircle, Refresh } from 'iconoir-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder, ScrollView, ScrollViewProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { TextX } from '~/components/ui/textx';
import { useOverlayInteractionLocked } from '~/hooks/use-overlay-interaction-lock';
import { useColor } from '~/hooks/useColor';

type PullToRefreshScrollViewProps = ScrollViewProps & {
    // Backward compatibility: no longer required/used after internalized refresh state.
    refreshing?: boolean;
    onRefresh: () => Promise<void> | void;
    pullEnabled?: boolean;
    containerBackgroundColor?: string;
    containerStyle?: StyleProp<ViewStyle>;
    minRefreshDurationMs?: number;
    successIconDurationMs?: number;
    reboundDurationMs?: number;
    idleIconOpacity?: number;
    indicatorSize?: number;
    isEmpty?: boolean;
    emptyText?: string;
    isLoadedAll?: boolean;
    loadedAllText?: string;
};

const RESTING_RATIO = 0.85;
const REST_DURATION_MS = 180;
const MAX_PULL_HEIGHT = 120;
const PULL_RESISTANCE = 2.5; // Larger means easier to pull further; smaller means stronger resistance.

function applyPullResistance(distance: number): number {
    if (distance <= 0) {
        return 0;
    }
    const resistanceBase = Math.max(1, MAX_PULL_HEIGHT * PULL_RESISTANCE);
    const resistedDistance = distance / (1 + distance / resistanceBase);
    return Math.min(MAX_PULL_HEIGHT, resistedDistance);
}

export function PullToRefreshScrollView({
    onRefresh,
    pullEnabled = true,
    containerBackgroundColor = 'transparent',
    containerStyle,
    minRefreshDurationMs = 1500,
    successIconDurationMs = 260,
    reboundDurationMs = 280,
    idleIconOpacity = 0.65,
    indicatorSize = 26,
    isEmpty = false,
    emptyText = '没有数据',
    isLoadedAll = false,
    loadedAllText = '已加载全部',
    children,
    onScroll,
    scrollEventThrottle = 16,
    ...scrollViewProps
}: PullToRefreshScrollViewProps) {
    const overlayInteractionLocked = useOverlayInteractionLocked();
    const effectivePullEnabled = pullEnabled && !overlayInteractionLocked;
    const scrollOffsetYRef = useRef(0);
    const refreshingRef = useRef(false);
    const [refreshing, setRefreshing] = React.useState(false);
    const [showRefreshSuccess, setShowRefreshSuccess] = React.useState(false);
    const pullDownPosition = useSharedValue(0);
    const pullProgress = useSharedValue(0);
    const refreshIconRotation = useSharedValue(0);
    const restingPosition = MAX_PULL_HEIGHT * RESTING_RATIO;
    const iconColor = useColor('text');
    const footerTextColor = useColor('textMuted');
    const refreshBackgroundColor = useColor('card');
    const footerText = isEmpty ? emptyText : isLoadedAll ? loadedAllText : null;

    useEffect(() => {
        refreshingRef.current = refreshing;
    }, [refreshing]);

    useEffect(() => {
        if (refreshing && !showRefreshSuccess) {
            refreshIconRotation.value = 0;
            refreshIconRotation.value = withRepeat(
                withTiming(360, {
                    duration: 900,
                    easing: Easing.linear,
                }),
                -1,
                false,
            );
            return;
        }
        refreshIconRotation.value = 0;
    }, [refreshIconRotation, refreshing, showRefreshSuccess]);

    const pullContainerStyle = useAnimatedStyle(() => ({
        height: pullDownPosition.value,
    }));

    const contentTranslateStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: pullDownPosition.value }],
    }));

    const indicatorStyle = useAnimatedStyle(
        () => ({
            opacity: refreshing || showRefreshSuccess ? 1 : idleIconOpacity + pullProgress.value * (1 - idleIconOpacity),
            transform: [
                {
                    rotate: `${refreshing && !showRefreshSuccess ? refreshIconRotation.value : pullProgress.value * 360}deg`,
                },
            ],
        }),
        [idleIconOpacity, refreshing, showRefreshSuccess],
    );

    const startRefresh = useCallback(async () => {
        if (refreshingRef.current) {
            return;
        }
        setRefreshing(true);
        setShowRefreshSuccess(false);
        pullProgress.value = 1;
        pullDownPosition.value = withTiming(restingPosition, { duration: REST_DURATION_MS });
        const startedAt = Date.now();
        try {
            await onRefresh();
            const elapsedMs = Date.now() - startedAt;
            const remainingMs = Math.max(0, minRefreshDurationMs - elapsedMs);
            if (remainingMs > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingMs));
            }
            setShowRefreshSuccess(true);
            await new Promise(resolve => setTimeout(resolve, successIconDurationMs));
            setRefreshing(false);
            pullProgress.value = 0;
            pullDownPosition.value = withTiming(0, { duration: reboundDurationMs });
            await new Promise(resolve => setTimeout(resolve, reboundDurationMs));
            setShowRefreshSuccess(false);
        } catch {
            // Keep refreshing state and pull position when refresh fails.
        }
    }, [minRefreshDurationMs, onRefresh, pullDownPosition, pullProgress, reboundDurationMs, restingPosition, successIconDurationMs]);

    const releasePull = useCallback(() => {
        const shouldRefresh = pullDownPosition.value >= restingPosition;
        pullDownPosition.value = withTiming(shouldRefresh ? restingPosition : 0, { duration: REST_DURATION_MS });
        pullProgress.value = shouldRefresh ? 1 : 0;
        if (shouldRefresh && !refreshingRef.current) {
            startRefresh();
        }
    }, [pullDownPosition, pullProgress, restingPosition, startRefresh]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponderCapture: () => false,
                onMoveShouldSetPanResponderCapture: (_, gestureState) => {
                    const isAtTop = scrollOffsetYRef.current <= 0;
                    const isPullingDown = gestureState.dy > 5;
                    return effectivePullEnabled && !refreshingRef.current && isAtTop && isPullingDown;
                },
                onPanResponderMove: (_, gestureState) => {
                    if (!effectivePullEnabled) {
                        return;
                    }
                    const nextPosition = applyPullResistance(gestureState.dy);
                    pullDownPosition.value = nextPosition;
                    pullProgress.value = Math.max(0, Math.min(1, nextPosition / restingPosition));
                },
                onPanResponderRelease: releasePull,
                onPanResponderTerminate: releasePull,
            }),
        [effectivePullEnabled, pullDownPosition, pullProgress, releasePull, restingPosition],
    );

    const handleScroll: ScrollViewProps['onScroll'] = event => {
        scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
    };

    return (
        <View style={[styles.root, { backgroundColor: refreshBackgroundColor }, containerStyle]}>
            <Animated.View style={[styles.pullContainer, pullContainerStyle]}>
                <Animated.View style={indicatorStyle}>
                    {showRefreshSuccess ? (
                        <CheckCircle width={indicatorSize} height={indicatorSize} color={iconColor} />
                    ) : (
                        <Refresh width={indicatorSize} height={indicatorSize} color={iconColor} />
                    )}
                </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.content, contentTranslateStyle]} {...panResponder.panHandlers}>
                <ScrollView
                    {...scrollViewProps}
                    style={[styles.scroll, { backgroundColor: containerBackgroundColor }, scrollViewProps.style]}
                    scrollEventThrottle={scrollEventThrottle}
                    onScroll={handleScroll}>
                    {children}
                    {footerText ? (
                        <View style={styles.footer}>
                            <TextX variant="description" style={{ color: footerTextColor }}>
                                {footerText}
                            </TextX>
                        </View>
                    ) : null}
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
    footer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
});
