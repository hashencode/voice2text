import React from 'react';
import type { ListRenderItem } from 'react-native';
import { View } from 'react-native';
import Animated, { type AnimatedRef } from 'react-native-reanimated';

type StickyMarker = { __sticky: true };
type ListItem<T> = StickyMarker | T;

type CollapsibleContainerListProps<T> = {
    listRef: AnimatedRef<Animated.FlatList<ListItem<T>>>;
    data: readonly ListItem<T>[];
    onScroll: any;
    renderStickyBar?: React.ReactNode;
    backgroundColor: string;
    headerSlotContent: React.ReactElement;
    listEmptyComponent?: React.ReactElement | null;
    listFooterComponent?: React.ReactElement | null;
    contentPaddingBottom: number;
    children: React.ReactNode;
    listKeyExtractor?: (item: T, index: number) => string;
    renderListItem?: ListRenderItem<T>;
};

export function CollapsibleContainerList<T>({
    listRef,
    data,
    onScroll,
    renderStickyBar,
    backgroundColor,
    headerSlotContent,
    listEmptyComponent,
    listFooterComponent,
    contentPaddingBottom,
    children,
    listKeyExtractor,
    renderListItem,
}: CollapsibleContainerListProps<T>) {
    return (
        <Animated.FlatList<ListItem<T>>
            ref={listRef}
            data={data}
            onScroll={onScroll}
            scrollEventThrottle={16}
            stickyHeaderIndices={renderStickyBar ? [1] : undefined}
            keyExtractor={(item, index) => {
                if (renderStickyBar && index === 0) {
                    return '__sticky-header__';
                }
                if (!listKeyExtractor) {
                    return String(index);
                }
                const originalIndex = renderStickyBar ? index - 1 : index;
                return listKeyExtractor(item as T, originalIndex);
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
                if (renderStickyBar && params.index === 0) {
                    return <View style={{ backgroundColor }}>{renderStickyBar}</View>;
                }
                if (!renderListItem) {
                    return null;
                }
                const originalIndex = renderStickyBar ? params.index - 1 : params.index;
                return renderListItem({
                    ...params,
                    index: originalIndex,
                    item: params.item as T,
                });
            }}
            contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
        />
    );
}
