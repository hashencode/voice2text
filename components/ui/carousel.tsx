import { useColor } from '@/hooks/useColor';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, TouchableOpacity, View, ViewStyle } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface CarouselProps {
    children: React.ReactNode[];
    autoPlay?: boolean;
    autoPlayInterval?: number;
    showIndicators?: boolean;
    showArrows?: boolean;
    loop?: boolean;
    itemWidth?: number;
    spacing?: number;
    style?: ViewStyle;
    onIndexChange?: (index: number) => void;
    classNames?: {
        root?: string;
        carouselItem?: string;
    };
}

export interface CarouselRef {
    goToSlide: (index: number) => void;
    goToNext: () => void;
    goToPrevious: () => void;
    getCurrentIndex: () => number;
}

export const Carousel = forwardRef<CarouselRef, CarouselProps>(
    (
        {
            children,
            autoPlay = false,
            autoPlayInterval = 3000,
            showIndicators = true,
            showArrows = false,
            loop = false,
            itemWidth,
            spacing = 0,
            style,
            onIndexChange,
            classNames,
        },
        ref,
    ) => {
        const listRef = useRef<FlatList>(null);
        const [currentIndex, setCurrentIndex] = useState(0);
        const [containerWidth, setContainerWidth] = useState(screenWidth);

        const autoplayTimer = useRef<any>(null);

        const slideWidth = itemWidth || containerWidth;
        const snapInterval = slideWidth + spacing;

        const total = children.length;

        const clearAutoplay = () => {
            if (autoplayTimer.current) {
                clearTimeout(autoplayTimer.current);
                autoplayTimer.current = null;
            }
        };

        const startAutoplay = useCallback(() => {
            if (!autoPlay || total <= 1) return;

            clearAutoplay();

            autoplayTimer.current = setTimeout(() => {
                goToNext();
                startAutoplay();
            }, autoPlayInterval);
        }, [autoPlay, autoPlayInterval, total]);

        useEffect(() => {
            startAutoplay();
            return clearAutoplay;
        }, [startAutoplay]);

        const scrollTo = (index: number, animated = true) => {
            listRef.current?.scrollToOffset({
                offset: index * snapInterval,
                animated,
            });
        };

        const goToSlide = useCallback(
            (index: number) => {
                if (index < 0 || index >= total) return;
                setCurrentIndex(index);
                scrollTo(index);
            },
            [total, snapInterval],
        );

        const goToNext = useCallback(() => {
            const next = currentIndex + 1;
            if (next >= total) {
                if (loop) goToSlide(0);
            } else {
                goToSlide(next);
            }
        }, [currentIndex, total, loop, goToSlide]);

        const goToPrevious = useCallback(() => {
            const prev = currentIndex - 1;
            if (prev < 0) {
                if (loop) goToSlide(total - 1);
            } else {
                goToSlide(prev);
            }
        }, [currentIndex, total, loop, goToSlide]);

        useImperativeHandle(ref, () => ({
            goToSlide,
            goToNext,
            goToPrevious,
            getCurrentIndex: () => currentIndex,
        }));

        const handleMomentumScrollEnd = useCallback(
            (e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
                if (index !== currentIndex) {
                    setCurrentIndex(index);
                    onIndexChange?.(index);
                }
            },
            [snapInterval, currentIndex, onIndexChange],
        );

        return (
            <View
                className={`w-full ${classNames?.root}`}
                style={style}
                onLayout={e => {
                    const w = e.nativeEvent.layout.width;
                    if (w) setContainerWidth(w);
                }}>
                <View className="relative">
                    <FlatList
                        ref={listRef}
                        horizontal
                        data={children}
                        keyExtractor={(_, i) => i.toString()}
                        pagingEnabled={!itemWidth}
                        snapToInterval={itemWidth ? snapInterval : undefined}
                        decelerationRate="fast"
                        showsHorizontalScrollIndicator={false}
                        initialNumToRender={3}
                        windowSize={5}
                        removeClippedSubviews
                        onMomentumScrollEnd={handleMomentumScrollEnd}
                        renderItem={({ item }) => (
                            <View
                                className={classNames?.carouselItem}
                                style={{
                                    width: slideWidth,
                                    marginRight: spacing || 2,
                                }}>
                                {item}
                            </View>
                        )}
                    />

                    {showArrows && total > 1 && (
                        <>
                            <Arrow direction="left" onPress={goToPrevious} disabled={!loop && currentIndex === 0} className="left-1.5" />
                            <Arrow
                                direction="right"
                                onPress={goToNext}
                                disabled={!loop && currentIndex === total - 1}
                                className="right-1.5"
                            />
                        </>
                    )}
                </View>

                {showIndicators && total > 1 && (
                    <Indicators total={total} current={currentIndex} onPress={goToSlide} className="mt-3 self-center" />
                )}
            </View>
        );
    },
);

function Indicators({
    total,
    current,
    onPress,
    className,
}: {
    total: number;
    current: number;
    onPress?: (index: number) => void;
    className?: string;
}) {
    const primary = useColor('primary');
    const secondary = useColor('secondary');

    return (
        <View className={`flex-row items-center gap-1.5 ${className || ''}`}>
            {Array.from({ length: total }).map((_, i) => (
                <TouchableOpacity
                    key={i}
                    onPress={() => onPress?.(i)}
                    className="h-2 w-2 rounded-full"
                    style={{
                        backgroundColor: i === current ? primary : secondary,
                    }}
                />
            ))}
        </View>
    );
}

function Arrow({
    direction,
    onPress,
    disabled,
    className,
}: {
    direction: 'left' | 'right';
    onPress: () => void;
    disabled?: boolean;
    className?: string;
}) {
    const color = useColor('primary');

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            className={`absolute top-1/2 h-7 w-7 -translate-y-3 items-center justify-center rounded-full bg-white/75 ${
                disabled ? 'opacity-30' : 'opacity-100'
            } ${className || ''}`}>
            {direction === 'left' ? <ChevronLeft size={20} color={color} /> : <ChevronRight size={20} color={color} />}
        </TouchableOpacity>
    );
}
