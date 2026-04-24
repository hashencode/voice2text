import React from 'react';
import { View } from 'react-native';
import Animated, { type AnimatedRef } from 'react-native-reanimated';

type CollapsibleContainerScrollProps = {
    scrollViewRef: AnimatedRef<Animated.ScrollView>;
    onScroll: any;
    renderStickyBar?: React.ReactNode;
    backgroundColor: string;
    headerSlotContent: React.ReactElement;
    contentPaddingBottom: number;
    children: React.ReactNode;
};

export function CollapsibleContainerScroll({
    scrollViewRef,
    onScroll,
    renderStickyBar,
    backgroundColor,
    headerSlotContent,
    contentPaddingBottom,
    children,
}: CollapsibleContainerScrollProps) {
    return (
        <Animated.ScrollView
            ref={scrollViewRef}
            onScroll={onScroll}
            scrollEventThrottle={16}
            stickyHeaderIndices={renderStickyBar ? [1] : undefined}
            contentContainerStyle={{ paddingBottom: contentPaddingBottom }}>
            {headerSlotContent}
            {renderStickyBar ? <View style={{ backgroundColor }}>{renderStickyBar}</View> : null}
            {children}
        </Animated.ScrollView>
    );
}
