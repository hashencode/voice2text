import React from 'react';
import type { ListRenderItem, StyleProp, TextStyle } from 'react-native';
import { LayoutChangeEvent, LayoutRectangle, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CollapsibleContainerList } from '~/components/layout/collapsible-container-list';
import { CollapsibleContainerScroll } from '~/components/layout/collapsible-container-scroll';
import { TextX } from '~/components/ui/textx';
import {
    DEFAULT_COLLAPSIBLE_STICKY_HEADER_THRESHOLDS,
    type CollapsibleStickyHeaderThresholds,
    useCollapsibleStickyHeader,
} from '~/components/layout/use-collapsible-sticky-header';
import { useColor } from '~/hooks/useColor';

type StickyMarker = { __sticky: true };
type ListItem<T> = StickyMarker | T;

type CollapsibleStickyHeaderLayoutProps<T> = {
    title: string;
    description: string;
    titleDockAlign?: 'left' | 'center';
    titleDockVerticalAlign?: 'dock' | 'topActionsCenter';
    titleFontSize?: number;
    titleDockFontSize?: number;
    titleLineHeight?: number;
    thresholds?: Partial<CollapsibleStickyHeaderThresholds>;
    contentPaddingBottom?: number;
    renderTopActions: (params: {
        onDockLayout: (layout: LayoutRectangle) => void;
        onHeightChange: (height: number) => void;
        isHeaderCollapsed: boolean;
    }) => React.ReactNode;
    renderHeroHeader: (params: {
        title: string;
        description: string;
        titleStyle: StyleProp<TextStyle>;
        onTitleLayout: (width: number, height: number, x: number, y: number) => void;
    }) => React.ReactNode;
    renderStickyBar?: React.ReactNode;
    listData?: readonly T[];
    renderListItem?: ListRenderItem<T>;
    listKeyExtractor?: (item: T, index: number) => string;
    listEmptyComponent?: React.ReactElement | null;
    listFooterComponent?: React.ReactElement | null;
    children: React.ReactNode;
};

export default function CollapsibleStickyHeaderLayout<T>({
    title,
    description,
    titleDockAlign = 'left',
    titleDockVerticalAlign = 'dock',
    titleFontSize = 34,
    titleDockFontSize = 18,
    titleLineHeight = 42,
    thresholds,
    contentPaddingBottom = 0,
    renderTopActions,
    renderHeroHeader,
    renderStickyBar,
    listData,
    renderListItem,
    listKeyExtractor,
    listEmptyComponent = null,
    listFooterComponent = null,
    children,
}: CollapsibleStickyHeaderLayoutProps<T>) {
    const backgroundColor = useColor('background');
    const textColor = useColor('text');
    const [slotHeight, setSlotHeight] = React.useState(0);
    const resolvedThresholds = React.useMemo(
        () => ({ ...DEFAULT_COLLAPSIBLE_STICKY_HEADER_THRESHOLDS, ...thresholds }),
        [thresholds],
    );

    const listModeEnabled = Boolean(listData && renderListItem);

    const {
        isHeaderCollapsed,
        onScroll,
        titleAnimatedStyle,
        slotAnimatedStyle,
        bindTopActionsHeight,
        bindDockLayout,
        bindTitleLayout,
        listRef,
        scrollViewRef,
        shouldRenderFloatingTitle,
    } = useCollapsibleStickyHeader<ListItem<T>>({
        listModeEnabled,
        titleDockAlign,
        titleDockVerticalAlign,
        titleFontSize,
        titleDockFontSize,
        thresholds: resolvedThresholds,
    });

    const handleSlotLayout = React.useCallback((event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height;
        setSlotHeight(prev => (prev > 0 ? prev : height));
    }, []);

    const headerSlotContent = (
        <View>
            <View
                className="relative overflow-hidden"
                style={slotHeight > 0 ? { height: slotHeight } : undefined}
                onLayout={handleSlotLayout}>
                <Animated.View
                    pointerEvents="none"
                    style={slotHeight > 0 ? [{ position: 'absolute', left: 0, right: 0, top: 0 }, slotAnimatedStyle] : slotAnimatedStyle}>
                    {renderHeroHeader({
                        title,
                        description,
                        titleStyle: { fontSize: titleFontSize, lineHeight: titleLineHeight },
                        onTitleLayout: bindTitleLayout,
                    })}
                </Animated.View>
            </View>
        </View>
    );

    const stickyMarker = React.useMemo<StickyMarker>(() => ({ __sticky: true }), []);
    const composedData = React.useMemo(() => {
        if (!listModeEnabled || !listData) {
            return null;
        }
        if (!renderStickyBar) {
            return listData as ListItem<T>[];
        }
        return [stickyMarker, ...(listData as ListItem<T>[])];
    }, [listData, listModeEnabled, renderStickyBar, stickyMarker]);

    return (
        <View className="flex-1">
            {renderTopActions({
                onDockLayout: bindDockLayout,
                onHeightChange: bindTopActionsHeight,
                isHeaderCollapsed,
            })}

            {listModeEnabled && composedData ? (
                <CollapsibleContainerList<T>
                    listRef={listRef}
                    data={composedData}
                    onScroll={onScroll}
                    renderStickyBar={renderStickyBar}
                    backgroundColor={backgroundColor}
                    headerSlotContent={headerSlotContent}
                    listEmptyComponent={listEmptyComponent}
                    listFooterComponent={listFooterComponent}
                    contentPaddingBottom={contentPaddingBottom}
                    children={children}
                    listKeyExtractor={listKeyExtractor}
                    renderListItem={renderListItem}
                />
            ) : (
                <CollapsibleContainerScroll
                    scrollViewRef={scrollViewRef}
                    onScroll={onScroll}
                    renderStickyBar={renderStickyBar}
                    backgroundColor={backgroundColor}
                    headerSlotContent={headerSlotContent}
                    contentPaddingBottom={contentPaddingBottom}
                    children={children}
                />
            )}

            {shouldRenderFloatingTitle ? (
                <Animated.View pointerEvents="none" className="absolute left-0 top-0" style={titleAnimatedStyle}>
                    <TextX style={{ color: textColor, fontSize: titleFontSize, lineHeight: titleLineHeight }}>{title}</TextX>
                </Animated.View>
            ) : null}
        </View>
    );
}
