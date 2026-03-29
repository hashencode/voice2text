import { TextX } from '@/components/ui/textx';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideProps } from 'lucide-react-native';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react-native';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, TouchableOpacity, useWindowDimensions, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Colors } from '~/theme/colors';
import { FONT_SIZE, FONT_SIZE_LG, FONT_SIZE_SM, LINE_HEIGHT_SIZE_LG, LINE_HEIGHT_SIZE_SM } from '~/theme/globals';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
    id: string;
    title?: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
    action?: {
        label: string;
        onPress: () => void;
    };
}

interface ToastProps extends ToastData {
    onDismiss: (id: string) => void;
    onShown: (id: string) => void;
    index: number;
    topInset: number;
    stackOffset: number;
    shouldDismiss: boolean;
}

const TOAST_MARGIN = 8;
type ToastLayoutConfig = {
    height: number;
    width: number;
    contentPaddingHorizontal: number;
    contentPaddingVertical: number;
    titleFontSize: number;
    titleLineHeight: number;
    descriptionFontSize?: number;
    descriptionLineHeight?: number;
};

function getToastLayoutConfig(screenWidth: number): { compact: ToastLayoutConfig; expanded: ToastLayoutConfig } {
    return {
        compact: {
            height: 40,
            width: Math.max(screenWidth - 200, 140),
            contentPaddingHorizontal: 12,
            contentPaddingVertical: 7,
            titleFontSize: FONT_SIZE,
            titleLineHeight: LINE_HEIGHT_SIZE_SM,
        },
        expanded: {
            height: 70,
            width: Math.max(screenWidth - 32, 280),
            contentPaddingHorizontal: 32,
            contentPaddingVertical: 10,
            titleFontSize: FONT_SIZE_LG,
            titleLineHeight: LINE_HEIGHT_SIZE_LG,
            descriptionFontSize: FONT_SIZE_SM,
            descriptionLineHeight: LINE_HEIGHT_SIZE_SM,
        },
    };
}

const VARIANT_BACKGROUND: Record<ToastVariant, string> = {
    default: '#1C1C1E',
    success: '#389e0d',
    error: '#cf1322',
    warning: '#d48806',
    info: '#0958d9',
};

const VARIANT_ICON: Partial<Record<ToastVariant, React.ComponentType<LucideProps>>> = {
    success: CircleCheck,
    error: CircleX,
    warning: TriangleAlert,
    info: Info,
};

// Reanimated spring configuration
const SPRING_CONFIG = {
    stiffness: 320,
    damping: 30,
    mass: 0.8,
    overshootClamping: true,
};

const TOAST_TIMING = {
    enter: 170,
    shownDelay: 220,
    dismiss: 180,
    defaultDuration: 3000,
} as const;

const ABSOLUTE_FILL: ViewStyle = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
};

function clampColor(value: number): number {
    return Math.max(0, Math.min(255, value));
}

function shiftHexColor(hex: string, amount: number): string {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) {
        return hex;
    }
    const r = clampColor(parseInt(normalized.slice(0, 2), 16) + amount);
    const g = clampColor(parseInt(normalized.slice(2, 4), 16) + amount);
    const b = clampColor(parseInt(normalized.slice(4, 6), 16) + amount);
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function Toast({
    id,
    title,
    description,
    variant = 'default',
    onDismiss,
    onShown,
    index,
    topInset,
    stackOffset,
    shouldDismiss,
    action,
}: ToastProps) {
    const { width: windowWidth } = useWindowDimensions();
    const layoutConfig = React.useMemo(() => getToastLayoutConfig(windowWidth), [windowWidth]);
    const isDismissingRef = useRef(false);

    // Reanimated shared values
    const translateY = useSharedValue(-100);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);
    const hasDescription = Boolean(description);
    const activeConfig = hasDescription ? layoutConfig.expanded : layoutConfig.compact;
    const width = useSharedValue(activeConfig.width);
    const height = useSharedValue(activeConfig.height);

    const textColor = Colors.light.card;
    const isExpanded = Boolean(title || description || action);
    const isCompact = !hasDescription;

    useEffect(() => {
        width.value = activeConfig.width;
        height.value = activeConfig.height;

        // Animate in toast
        translateY.value = withTiming(0, { duration: TOAST_TIMING.enter });
        opacity.value = withTiming(1, { duration: TOAST_TIMING.enter });
        scale.value = withTiming(1, { duration: TOAST_TIMING.enter });

        const shownTimer = setTimeout(() => {
            onShown(id);
        }, TOAST_TIMING.shownDelay);

        return () => {
            clearTimeout(shownTimer);
        };
    }, [activeConfig.height, activeConfig.width, id, onShown]);

    const variantBackgroundColor = VARIANT_BACKGROUND[variant];

    const getIcon = (iconSize: number, strokeWidth: number) => {
        const IconComponent = VARIANT_ICON[variant];
        if (!IconComponent) {
            return null;
        }
        const iconProps = { size: iconSize, color: textColor, strokeWidth };
        return <IconComponent {...iconProps} />;
    };

    const renderGlassIcon = () => {
        const icon = getIcon(100, 1.7);
        if (!icon) {
            return null;
        }

        return <View className="absolute -right-3 top-1 opacity-50">{icon}</View>;
    };

    const renderInlineIcon = () => {
        const icon = getIcon(18, 2);
        if (!icon) {
            return null;
        }
        return <View className="mr-2">{icon}</View>;
    };

    const dismissOnUiThread = useCallback(() => {
        'worklet';
        scheduleOnRN(onDismiss, id);
    }, [id, onDismiss]);

    const dismiss = useCallback(() => {
        if (isDismissingRef.current) {
            return;
        }
        isDismissingRef.current = true;

        translateY.value = withTiming(-80, { duration: TOAST_TIMING.dismiss });
        opacity.value = withTiming(0, { duration: TOAST_TIMING.dismiss }, finished => {
            if (finished) {
                dismissOnUiThread();
            }
        });
        scale.value = withTiming(0.9, { duration: TOAST_TIMING.dismiss });
    }, [dismissOnUiThread]);

    useEffect(() => {
        if (!shouldDismiss) {
            return;
        }
        dismiss();
    }, [dismiss, shouldDismiss]);

    const panGesture = Gesture.Pan()
        .onUpdate(event => {
            translateY.value = Math.min(0, event.translationY);
        })
        .onEnd(event => {
            const { translationY, velocityY } = event;

            if (translationY < -24 || velocityY < -700) {
                scheduleOnRN(dismiss);
            } else {
                translateY.value = withSpring(0, SPRING_CONFIG);
            }
        });

    const getTopPosition = () => {
        const safeTop = Math.max(topInset, Platform.OS === 'ios' ? 8 : 12);
        return safeTop + TOAST_MARGIN + stackOffset;
    };

    // Animated styles
    const animatedContainerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }, { scale: scale.value }],
    }));

    const animatedIslandStyle = useAnimatedStyle(() => ({
        ...(isCompact ? { maxWidth: width.value } : { width: width.value }),
        height: height.value,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    }));

    const toastStyle: ViewStyle = {
        top: getTopPosition(),
        zIndex: 1000 + index,
    };
    const gradientColors: [string, string] = [shiftHexColor(variantBackgroundColor, -16), shiftHexColor(variantBackgroundColor, 22)];
    const glassIcon = renderGlassIcon();
    const inlineIcon = renderInlineIcon();

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View className="absolute self-center shadow" style={[toastStyle, animatedContainerStyle]}>
                <Animated.View className="rounded-full" style={animatedIslandStyle}>
                    <LinearGradient colors={gradientColors} start={{ x: 0, y: 1 }} end={{ x: 1, y: 1 }} style={ABSOLUTE_FILL} />

                    {/* Expanded state - full content */}
                    {isExpanded && (
                        <Animated.View
                            className={isCompact ? 'flex-row items-center' : 'absolute inset-0 flex-row items-center'}
                            style={{
                                paddingHorizontal: activeConfig.contentPaddingHorizontal,
                                paddingVertical: activeConfig.contentPaddingVertical,
                                maxWidth: isCompact ? '100%' : undefined,
                            }}>
                            {isCompact ? inlineIcon : null}
                            <View className={isCompact ? 'min-w-0 pr-2' : 'min-w-0 flex-1'}>
                                {title && (
                                    <TextX
                                        variant={isCompact ? 'body' : 'subtitle'}
                                        style={{
                                            color: textColor,
                                            fontSize: activeConfig.titleFontSize,
                                            lineHeight: activeConfig.titleLineHeight,
                                        }}
                                        numberOfLines={1}
                                        ellipsizeMode="tail">
                                        {title}
                                    </TextX>
                                )}
                                {!isCompact && description && (
                                    <TextX
                                        variant="description"
                                        style={{
                                            color: textColor,
                                            fontSize: activeConfig.descriptionFontSize,
                                            lineHeight: activeConfig.descriptionLineHeight,
                                        }}
                                        numberOfLines={1}
                                        ellipsizeMode="tail">
                                        {description}
                                    </TextX>
                                )}
                            </View>

                            {action && (
                                <TouchableOpacity
                                    onPress={action.onPress}
                                    className="ml-3 rounded-xl px-3 py-1.5"
                                    style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}>
                                    <TextX
                                        variant="body"
                                        style={{
                                            color: textColor,
                                        }}>
                                        {action.label}
                                    </TextX>
                                </TouchableOpacity>
                            )}

                            {isCompact ? null : glassIcon}
                        </Animated.View>
                    )}
                </Animated.View>
            </Animated.View>
        </GestureDetector>
    );
}

interface ToastContextType {
    toast: (toast: Omit<ToastData, 'id'>) => void;
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
    dismiss: (id: string) => void;
    dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

interface ToastProviderProps {
    children: React.ReactNode;
    maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 3 }: ToastProviderProps) {
    const { width: windowWidth } = useWindowDimensions();
    const layoutConfig = React.useMemo(() => getToastLayoutConfig(windowWidth), [windowWidth]);
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
    const insets = useSafeAreaInsets();
    const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const durationMapRef = useRef<Map<string, number>>(new Map());
    const resolveDuration = useCallback((duration?: number) => duration ?? TOAST_TIMING.defaultDuration, []);

    const getToastStackHeight = useCallback(
        (toast: ToastData) => {
            return (toast.description ? layoutConfig.expanded.height : layoutConfig.compact.height) + TOAST_MARGIN;
        },
        [layoutConfig.compact.height, layoutConfig.expanded.height],
    );

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const clearDismissTimer = useCallback((id: string) => {
        const timer = dismissTimersRef.current.get(id);
        if (!timer) {
            return;
        }

        clearTimeout(timer);
        dismissTimersRef.current.delete(id);
    }, []);

    const markToastDismissing = useCallback((id: string) => {
        setDismissingIds(prev => {
            if (prev.has(id)) {
                return prev;
            }
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    const dismissToast = useCallback(
        (id: string) => {
            clearDismissTimer(id);
            durationMapRef.current.delete(id);
            setToasts(prev => prev.filter(toast => toast.id !== id));
            setDismissingIds(prev => {
                if (!prev.has(id)) {
                    return prev;
                }
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        },
        [clearDismissTimer],
    );

    const scheduleDismiss = useCallback(
        (id: string) => {
            clearDismissTimer(id);

            const duration = resolveDuration(durationMapRef.current.get(id));
            if (duration <= 0) {
                return;
            }

            const timer = setTimeout(() => {
                markToastDismissing(id);
            }, duration);
            dismissTimersRef.current.set(id, timer);
        },
        [clearDismissTimer, markToastDismissing, resolveDuration],
    );

    const addToast = useCallback(
        (toastData: Omit<ToastData, 'id'>) => {
            const id = generateId();
            const newToast: ToastData = {
                ...toastData,
                id,
                duration: resolveDuration(toastData.duration),
            };

            setToasts(prev => {
                const updated = [newToast, ...prev];
                const sliced = updated.slice(0, maxToasts);
                const keptIds = new Set(sliced.map(toast => toast.id));
                for (const existing of updated) {
                    if (keptIds.has(existing.id)) {
                        continue;
                    }
                    clearDismissTimer(existing.id);
                    durationMapRef.current.delete(existing.id);
                    setDismissingIds(prevIds => {
                        if (!prevIds.has(existing.id)) {
                            return prevIds;
                        }
                        const nextIds = new Set(prevIds);
                        nextIds.delete(existing.id);
                        return nextIds;
                    });
                }
                return sliced;
            });
            durationMapRef.current.set(id, resolveDuration(newToast.duration));
        },
        [clearDismissTimer, maxToasts, resolveDuration],
    );

    const dismissAll = useCallback(() => {
        dismissTimersRef.current.forEach(timer => {
            clearTimeout(timer);
        });
        dismissTimersRef.current.clear();
        durationMapRef.current.clear();
        setToasts([]);
        setDismissingIds(new Set());
    }, []);

    const createVariantToast = useCallback(
        (variant: ToastVariant, title: string, description?: string) => {
            addToast({
                title,
                description,
                variant,
            });
        },
        [addToast],
    );

    const contextValue: ToastContextType = {
        toast: addToast,
        success: (title, description) => createVariantToast('success', title, description),
        error: (title, description) => createVariantToast('error', title, description),
        warning: (title, description) => createVariantToast('warning', title, description),
        info: (title, description) => createVariantToast('info', title, description),
        dismiss: dismissToast,
        dismissAll,
    };

    return (
        <ToastContext.Provider value={contextValue}>
            <GestureHandlerRootView className="flex-1">
                {children}
                <View className="pointer-events-box-none absolute left-0 right-0 top-0 z-[1000]" pointerEvents="box-none">
                    {(() => {
                        let stackOffset = 0;
                        return toasts.map((toast, index) => {
                            const currentOffset = stackOffset;
                            stackOffset += getToastStackHeight(toast);
                            return (
                                <Toast
                                    key={toast.id}
                                    {...toast}
                                    index={index}
                                    stackOffset={currentOffset}
                                    topInset={insets.top}
                                    onShown={scheduleDismiss}
                                    shouldDismiss={dismissingIds.has(toast.id)}
                                    onDismiss={dismissToast}
                                />
                            );
                        });
                    })()}
                </View>
            </GestureHandlerRootView>
        </ToastContext.Provider>
    );
}

// Hook to use toast
export function useToast() {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    return context;
}
