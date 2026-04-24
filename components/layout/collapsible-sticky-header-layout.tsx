import React from 'react';
import type { ListRenderItem } from 'react-native';
import { AccessibilityInfo, LayoutChangeEvent, LayoutRectangle, View } from 'react-native';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
} from 'react-native-reanimated';
import { TextX } from '~/components/ui/textx';
import CollapsibleHeaderSlot from '~/features/home/components/collapsible-header-slot';
import { useColor } from '~/hooks/useColor';

const COLLAPSE_DISTANCE = 180;
const DOCK_ENTER_THRESHOLD = 72;
const DOCK_EXIT_THRESHOLD = 56;

type CollapsibleStickyHeaderLayoutProps = {
    title: string;
    description: string;
    titleFontSize?: number;
    titleDockFontSize?: number;
    titleLineHeight?: number;
    contentPaddingBottom?: number;
    headerBottom?: React.ReactNode;
    renderHeaderTop: (params: {
        onDockLayout: (layout: LayoutRectangle) => void;
        onHeightChange: (height: number) => void;
    }) => React.ReactNode;
    listData?: readonly unknown[];
    renderListItem?: ListRenderItem<unknown>;
    listKeyExtractor?: (item: unknown, index: number) => string;
    listEmptyComponent?: React.ReactElement | null;
    listFooterComponent?: React.ReactElement | null;
    children: React.ReactNode;
};

export default function CollapsibleStickyHeaderLayout({
    title,
    description,
    titleFontSize = 34,
    titleDockFontSize = 18,
    titleLineHeight = 42,
    contentPaddingBottom = 0,
    headerBottom,
    renderHeaderTop,
    listData,
    renderListItem,
    listKeyExtractor,
    listEmptyComponent = null,
    listFooterComponent = null,
    children,
}: CollapsibleStickyHeaderLayoutProps) {
    const backgroundColor = useColor('background');
    const textColor = useColor('text');
    const [topActionsHeight, setTopActionsHeight] = React.useState(0);
    const [dockLayout, setDockLayout] = React.useState<LayoutRectangle>({ x: 16, y: 0, width: 0, height: 0 });
    const [sourceX, setSourceX] = React.useState(16);
    const [sourceLocalY, setSourceLocalY] = React.useState(0);
    const [sourceWidth, setSourceWidth] = React.useState(0);
    const [sourceHeight, setSourceHeight] = React.useState(28);
    const [sourceReady, setSourceReady] = React.useState(false);
    const [slotHeight, setSlotHeight] = React.useState(0);
    const [reduceMotion, setReduceMotion] = React.useState(false);

    const dockScale = titleDockFontSize / titleFontSize;

    const scrollOffsetY = useSharedValue(0);
    const reduceMotionValue = useSharedValue(0);
    const dockedState = useSharedValue(0);

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

    const onScroll = useAnimatedScrollHandler(event => {
        scrollOffsetY.value = Math.max(0, event.contentOffset.y);
    });

    useDerivedValue(() => {
        if (scrollOffsetY.value >= DOCK_ENTER_THRESHOLD) {
            dockedState.value = 1;
            return;
        }
        if (scrollOffsetY.value <= DOCK_EXIT_THRESHOLD) {
            dockedState.value = 0;
        }
    });

    const titleStyle = useAnimatedStyle(() => {
        const sourceCenterStartY = topActionsHeight + sourceLocalY + sourceHeight / 2;
        const targetCenterY = dockLayout.y + dockLayout.height / 2;
        const travelY = Math.max(1, sourceCenterStartY - targetCenterY);
        const shiftY = Math.min(scrollOffsetY.value, travelY);
        const centerY = sourceCenterStartY - shiftY;
        const rawProgress =
            reduceMotionValue.value === 1
                ? dockedState.value
                : interpolate(scrollOffsetY.value, [0, COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP);
        const easedProgress = Easing.out(Easing.cubic)(rawProgress);
        const scale = 1 - easedProgress * (1 - dockScale);
        const translateY = centerY - sourceHeight / 2;

        return {
            transformOrigin: 'left center',
            transform: [{ translateX: sourceX }, { translateY }, { scale }],
        };
    }, [dockLayout, dockScale, sourceHeight, sourceLocalY, sourceX, topActionsHeight]);

    const slotContentStyle = useAnimatedStyle(() => {
        const rawProgress =
            reduceMotionValue.value === 1
                ? dockedState.value
                : interpolate(scrollOffsetY.value, [0, COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP);
        const easedProgress = Easing.out(Easing.cubic)(rawProgress);
        return {
            opacity: 1 - easedProgress,
            transform: [{ translateY: -12 * easedProgress }],
        };
    });

    const handleTitleLayout = React.useCallback(
        (width: number, height: number, x: number, y: number) => {
            if (sourceReady) {
                return;
            }
            setSourceWidth(width);
            setSourceHeight(height);
            setSourceX(x);
            setSourceLocalY(y);
            setSourceReady(true);
        },
        [sourceReady],
    );

    const handleTopActionsHeightChange = React.useCallback((height: number) => {
        setTopActionsHeight(prev => (prev === height ? prev : height));
    }, []);

    const handleDockLayoutChange = React.useCallback((layout: LayoutRectangle) => {
        setDockLayout(prev => {
            if (prev.x === layout.x && prev.y === layout.y && prev.width === layout.width && prev.height === layout.height) {
                return prev;
            }
            return layout;
        });
    }, []);

    const handleSlotLayout = React.useCallback((event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height;
        setSlotHeight(prev => (prev > 0 ? prev : height));
    }, []);

    const headerSlotContent = (
        <View>
            <View className="relative overflow-hidden" style={slotHeight > 0 ? { height: slotHeight } : undefined} onLayout={handleSlotLayout}>
                <Animated.View
                    pointerEvents="none"
                    style={
                        slotHeight > 0
                            ? [{ position: 'absolute', left: 0, right: 0, top: 0 }, slotContentStyle]
                            : slotContentStyle
                    }>
                    <CollapsibleHeaderSlot
                        title={title}
                        description={description}
                        titleStyle={{ fontSize: titleFontSize, lineHeight: titleLineHeight }}
                        onTitleLayout={handleTitleLayout}
                    />
                </Animated.View>
            </View>
        </View>
    );

    const listModeEnabled = Boolean(listData && renderListItem);
    const stickyMarker = React.useMemo(() => ({ __sticky: true }), []);
    const composedData = React.useMemo(() => {
        if (!listModeEnabled || !listData) {
            return null;
        }
        if (!headerBottom) {
            return listData as unknown[];
        }
        return [stickyMarker, ...(listData as unknown[])];
    }, [headerBottom, listData, listModeEnabled, stickyMarker]);

    return (
        <View className="flex-1">
            {renderHeaderTop({
                onDockLayout: handleDockLayoutChange,
                onHeightChange: handleTopActionsHeightChange,
            })}

            {listModeEnabled && composedData ? (
                <Animated.FlatList
                    data={composedData}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    stickyHeaderIndices={headerBottom ? [1] : undefined}
                    keyExtractor={(item, index) => {
                        if (headerBottom && index === 0) {
                            return '__sticky-header__';
                        }
                        if (!listKeyExtractor) {
                            return String(index);
                        }
                        const originalIndex = headerBottom ? index - 1 : index;
                        const originalItem = (listData as unknown[])[originalIndex];
                        return listKeyExtractor(originalItem, originalIndex);
                    }}
                    ListHeaderComponent={headerSlotContent}
                    ListEmptyComponent={listEmptyComponent}
                    ListFooterComponent={
                        <>
                            {children}
                            {listFooterComponent}
                        </>
                    }
                    renderItem={params => {
                        if (headerBottom && params.index === 0) {
                            return <View style={{ backgroundColor }}>{headerBottom}</View>;
                        }
                        const originalIndex = headerBottom ? params.index - 1 : params.index;
                        const originalItem = (listData as unknown[])[originalIndex];
                        if (!renderListItem) {
                            return null;
                        }
                        return renderListItem({
                            ...params,
                            index: originalIndex,
                            item: originalItem,
                        });
                    }}
                    contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
                />
            ) : (
                <Animated.ScrollView
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    stickyHeaderIndices={headerBottom ? [1] : undefined}
                    contentContainerStyle={{ paddingBottom: contentPaddingBottom }}>
                    {headerSlotContent}
                    {headerBottom ? <View style={{ backgroundColor }}>{headerBottom}</View> : null}
                    {children}
                </Animated.ScrollView>
            )}

            {topActionsHeight > 0 && sourceReady && sourceWidth > 0 ? (
                <Animated.View pointerEvents="none" className="absolute left-0 top-0" style={titleStyle}>
                    <TextX style={{ color: textColor, fontSize: titleFontSize, lineHeight: titleLineHeight }}>{title}</TextX>
                </Animated.View>
            ) : null}
        </View>
    );
}
