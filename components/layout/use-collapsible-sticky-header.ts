import React from 'react';
import { AccessibilityInfo, LayoutRectangle } from 'react-native';
import Animated, {
    cancelAnimation,
    Easing,
    Extrapolation,
    interpolate,
    runOnJS,
    scrollTo,
    useAnimatedReaction,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

export type CollapsibleStickyHeaderThresholds = {
    dockEnter: number;
    dockExit: number;
    snapTarget: number;
    snapThreshold: number;
};

export const DEFAULT_COLLAPSIBLE_STICKY_HEADER_THRESHOLDS: CollapsibleStickyHeaderThresholds = {
    dockEnter: 72,
    dockExit: 56,
    snapTarget: 72,
    snapThreshold: 52,
};

const SNAP_VELOCITY_TOLERANCE = 0.2;
const SNAP_DIRECTION_VELOCITY = 0.35;
const SNAP_LINEAR_DURATION_MS = 180;

type UseCollapsibleStickyHeaderParams = {
    listModeEnabled: boolean;
    titleDockAlign: 'left' | 'center';
    titleDockVerticalAlign: 'dock' | 'topActionsCenter';
    titleFontSize: number;
    titleDockFontSize: number;
    thresholds: CollapsibleStickyHeaderThresholds;
};

export function useCollapsibleStickyHeader<TListItem>({
    listModeEnabled,
    titleDockAlign,
    titleDockVerticalAlign,
    titleFontSize,
    titleDockFontSize,
    thresholds,
}: UseCollapsibleStickyHeaderParams) {
    const [topActionsHeight, setTopActionsHeight] = React.useState(0);
    const [dockLayout, setDockLayout] = React.useState<LayoutRectangle>({ x: 16, y: 0, width: 0, height: 0 });
    const [sourceX, setSourceX] = React.useState(16);
    const [sourceLocalY, setSourceLocalY] = React.useState(0);
    const [sourceWidth, setSourceWidth] = React.useState(0);
    const [sourceHeight, setSourceHeight] = React.useState(28);
    const [sourceReady, setSourceReady] = React.useState(false);
    const [reduceMotion, setReduceMotion] = React.useState(false);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false);
    const isHeaderCollapsedRef = React.useRef(false);

    const dockScale = titleDockFontSize / titleFontSize;
    const listRef = useAnimatedRef<Animated.FlatList<TListItem>>();
    const scrollViewRef = useAnimatedRef<Animated.ScrollView>();

    const scrollOffsetY = useSharedValue(0);
    const reduceMotionValue = useSharedValue(0);
    const dockedState = useSharedValue(0);
    const snapAnimatedOffsetY = useSharedValue(0);

    const handleHeaderCollapsedChange = React.useCallback((next: boolean) => {
        if (isHeaderCollapsedRef.current === next) {
            return;
        }
        isHeaderCollapsedRef.current = next;
        setIsHeaderCollapsed(next);
    }, []);

    React.useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then(enabled => {
                if (mounted) {
                    setReduceMotion(enabled);
                }
            })
            .catch(() => {});

        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
            setReduceMotion(enabled);
        });
        return () => {
            mounted = false;
            subscription.remove();
        };
    }, []);

    React.useEffect(() => {
        reduceMotionValue.value = reduceMotion ? 1 : 0;
    }, [reduceMotion, reduceMotionValue]);

    const snapToNearestState = React.useCallback(
        (offsetY: number, velocityY: number) => {
            'worklet';
            const normalizedOffsetY = Math.max(0, offsetY);
            const shouldSnapInRange = normalizedOffsetY <= thresholds.snapTarget + thresholds.snapThreshold;
            if (!shouldSnapInRange) {
                return;
            }
            const targetY =
                velocityY >= SNAP_DIRECTION_VELOCITY
                    ? thresholds.snapTarget
                    : velocityY <= -SNAP_DIRECTION_VELOCITY
                      ? 0
                      : normalizedOffsetY >= thresholds.snapThreshold
                        ? thresholds.snapTarget
                        : 0;
            if (Math.abs(normalizedOffsetY - targetY) <= 1) {
                return;
            }
            cancelAnimation(snapAnimatedOffsetY);
            snapAnimatedOffsetY.value = normalizedOffsetY;
            snapAnimatedOffsetY.value = withTiming(targetY, {
                duration: SNAP_LINEAR_DURATION_MS,
                easing: Easing.linear,
            });
        },
        [snapAnimatedOffsetY, thresholds.snapTarget, thresholds.snapThreshold],
    );

    useAnimatedReaction(
        () => snapAnimatedOffsetY.value,
        (nextY, prevY) => {
            if (prevY === null || Math.abs(nextY - prevY) < 0.1) {
                return;
            }
            if (listModeEnabled) {
                scrollTo(listRef, 0, nextY, false);
                return;
            }
            scrollTo(scrollViewRef, 0, nextY, false);
        },
        [listModeEnabled, listRef, scrollViewRef],
    );

    const onScroll = useAnimatedScrollHandler({
        onScroll: event => {
            const offsetY = Math.max(0, event.contentOffset.y);
            scrollOffsetY.value = offsetY;

            if (offsetY >= thresholds.dockEnter && dockedState.value === 0) {
                dockedState.value = 1;
                runOnJS(handleHeaderCollapsedChange)(true);
                return;
            }
            if (offsetY <= thresholds.dockExit && dockedState.value === 1) {
                dockedState.value = 0;
                runOnJS(handleHeaderCollapsedChange)(false);
            }
        },
        onEndDrag: event => {
            const velocityY = event.velocity?.y ?? 0;
            if (Math.abs(velocityY) <= SNAP_VELOCITY_TOLERANCE) {
                snapToNearestState(event.contentOffset.y, velocityY);
            }
        },
        onMomentumEnd: event => {
            snapToNearestState(event.contentOffset.y, 0);
        },
    });

    const titleAnimatedStyle = useAnimatedStyle(() => {
        const sourceCenterStartY = topActionsHeight + sourceLocalY + sourceHeight / 2;
        const targetCenterY = titleDockVerticalAlign === 'topActionsCenter' ? topActionsHeight / 2 : dockLayout.y + dockLayout.height / 2;
        const travelY = Math.max(1, sourceCenterStartY - targetCenterY);
        const shiftY = Math.min(scrollOffsetY.value, travelY);
        const centerY = sourceCenterStartY - shiftY;
        const rawProgress =
            reduceMotionValue.value === 1
                ? dockedState.value
                : interpolate(scrollOffsetY.value, [0, thresholds.dockEnter], [0, 1], Extrapolation.CLAMP);
        const progress = rawProgress;
        const scale = 1 - progress * (1 - dockScale);
        const scaledWidth = sourceWidth * scale;
        const centeredTargetX = dockLayout.x + Math.max(0, (dockLayout.width - scaledWidth) / 2);
        const targetX = titleDockAlign === 'center' ? centeredTargetX : sourceX;
        const translateX = sourceX + (targetX - sourceX) * progress;
        const translateY = centerY - sourceHeight / 2;

        return {
            transformOrigin: 'left center',
            transform: [{ translateX }, { translateY }, { scale }],
        };
    }, [dockLayout, dockScale, sourceHeight, sourceLocalY, sourceWidth, sourceX, thresholds.dockEnter, titleDockAlign, titleDockVerticalAlign, topActionsHeight]);

    const slotAnimatedStyle = useAnimatedStyle(() => {
        const rawProgress =
            reduceMotionValue.value === 1
                ? dockedState.value
                : interpolate(scrollOffsetY.value, [0, thresholds.dockEnter], [0, 1], Extrapolation.CLAMP);
        const progress = rawProgress;
        return {
            opacity: 1 - progress,
            transform: [{ translateY: -12 * progress }],
        };
    }, [thresholds.dockEnter]);

    const bindTitleLayout = React.useCallback((width: number, height: number, x: number, y: number) => {
        setSourceWidth(width);
        setSourceHeight(height);
        setSourceX(x);
        setSourceLocalY(y);
        setSourceReady(true);
    }, []);

    const bindTopActionsHeight = React.useCallback((height: number) => {
        setTopActionsHeight(prev => (prev === height ? prev : height));
    }, []);

    const bindDockLayout = React.useCallback((layout: LayoutRectangle) => {
        setDockLayout(prev => {
            if (prev.x === layout.x && prev.y === layout.y && prev.width === layout.width && prev.height === layout.height) {
                return prev;
            }
            return layout;
        });
    }, []);

    return {
        isHeaderCollapsed,
        onScroll,
        titleAnimatedStyle,
        slotAnimatedStyle,
        bindTopActionsHeight,
        bindDockLayout,
        bindTitleLayout,
        listRef,
        scrollViewRef,
        shouldRenderFloatingTitle: topActionsHeight > 0 && sourceReady && sourceWidth > 0,
    };
}
