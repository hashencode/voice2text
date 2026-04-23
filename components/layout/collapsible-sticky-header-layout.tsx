import React from 'react';
import { AccessibilityInfo, LayoutRectangle, View } from 'react-native';
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
    renderHeaderTop: (params: { onDockLayout: (layout: LayoutRectangle) => void; onHeightChange: (height: number) => void }) => React.ReactNode;
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
    children,
}: CollapsibleStickyHeaderLayoutProps) {
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
        const scaleXCompensation = (sourceWidth * (1 - scale)) / 2;
        const translateX = sourceX - scaleXCompensation;
        const translateY = centerY - sourceHeight / 2;

        return {
            transform: [{ translateX }, { translateY }, { scale }],
        };
    }, [dockLayout, dockScale, sourceHeight, sourceLocalY, sourceWidth, sourceX, topActionsHeight]);

    const subTextStyle = useAnimatedStyle(() => {
        const rawProgress =
            reduceMotionValue.value === 1
                ? dockedState.value
                : interpolate(scrollOffsetY.value, [0, COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP);
        const easedProgress = Easing.out(Easing.cubic)(rawProgress);
        return {
            opacity: 1 - easedProgress,
        };
    });

    const slotCollapseStyle = useAnimatedStyle(() => {
        const rawProgress =
            reduceMotionValue.value === 1
                ? dockedState.value
                : interpolate(scrollOffsetY.value, [0, COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP);
        const easedProgress = Easing.out(Easing.cubic)(rawProgress);
        return {
            height: Math.max(0, slotHeight * (1 - easedProgress)),
            overflow: 'hidden',
        };
    }, [slotHeight]);

    return (
        <View className="flex-1">
            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                stickyHeaderIndices={[0]}
                contentContainerStyle={{ paddingBottom: contentPaddingBottom }}>
                <View>
                    {renderHeaderTop({
                        onDockLayout: setDockLayout,
                        onHeightChange: setTopActionsHeight,
                    })}
                    <Animated.View style={slotHeight > 0 ? slotCollapseStyle : undefined}>
                        <Animated.View style={subTextStyle}>
                            <View
                                onLayout={event => {
                                    if (slotHeight <= 0) {
                                        setSlotHeight(event.nativeEvent.layout.height);
                                    }
                                }}>
                                <CollapsibleHeaderSlot
                                    title={title}
                                    description={description}
                                    titleStyle={{ fontSize: titleFontSize, lineHeight: titleLineHeight }}
                                    onTitleLayout={(width, height, x, y) => {
                                        if (sourceReady) {
                                            return;
                                        }
                                        setSourceWidth(width);
                                        setSourceHeight(height);
                                        setSourceX(x);
                                        setSourceLocalY(y);
                                        setSourceReady(true);
                                    }}
                                />
                            </View>
                        </Animated.View>
                    </Animated.View>
                    {headerBottom}
                </View>
                {children}
            </Animated.ScrollView>

            {topActionsHeight > 0 && sourceReady && sourceWidth > 0 ? (
                <Animated.View pointerEvents="none" className="absolute left-0 top-0" style={titleStyle}>
                    <TextX style={{ color: textColor, fontSize: titleFontSize, lineHeight: titleLineHeight }}>{title}</TextX>
                </Animated.View>
            ) : null}
        </View>
    );
}
