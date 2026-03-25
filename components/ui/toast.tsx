import { TextX } from '@/components/ui/textx';
import { LinearGradient } from 'expo-linear-gradient';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react-native';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Colors } from '~/theme/colors';
import { BORDER_RADIUS } from '~/theme/globals';

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
    shouldDismiss: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const DYNAMIC_ISLAND_HEIGHT = 37;
const EXPANDED_HEIGHT = 76;
const TOAST_MARGIN = 8;
const DYNAMIC_ISLAND_WIDTH = 126;
const EXPANDED_WIDTH = screenWidth - 32;

// Reanimated spring configuration
const SPRING_CONFIG = {
    stiffness: 320,
    damping: 30,
    mass: 0.8,
    overshootClamping: true,
};

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
    shouldDismiss,
    action,
}: ToastProps) {
    const isDismissingRef = useRef(false);

    // Reanimated shared values
    const translateY = useSharedValue(-100);
    const translateX = useSharedValue(0);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.8);
    const width = useSharedValue(DYNAMIC_ISLAND_WIDTH);
    const height = useSharedValue(DYNAMIC_ISLAND_HEIGHT);
    const borderRadius = useSharedValue(BORDER_RADIUS);

    const textColor = Colors.light.card;
    const isExpanded = Boolean(title || description || action);

    useEffect(() => {
        const shownNotifyDelay = isExpanded ? 220 : 150;

        if (isExpanded) {
            // If there's content, start directly with expanded state
            width.value = EXPANDED_WIDTH;
            height.value = EXPANDED_HEIGHT;
            borderRadius.value = 9999;

            // Animate in expanded toast
            translateY.value = withTiming(0, { duration: 170 });
            opacity.value = withTiming(1, { duration: 170 });
            scale.value = withTiming(1, { duration: 170 });
        } else {
            // Animate in compact toast
            translateY.value = withTiming(0, { duration: 140 });
            opacity.value = withTiming(1, { duration: 140 });
            scale.value = withTiming(1, { duration: 140 });
        }

        const shownTimer = setTimeout(() => {
            onShown(id);
        }, shownNotifyDelay);

        return () => {
            clearTimeout(shownTimer);
        };
    }, [id, isExpanded, onShown]);

    const variantBackgroundColor = (() => {
        switch (variant) {
            case 'success':
                return '#389e0d'; // antd green (same level as info)
            case 'error':
                return '#cf1322'; // antd red (same level as info)
            case 'warning':
                return '#d48806'; // antd gold (same level as info)
            case 'info':
                return '#0958d9'; // antd blue (user-specified)
            default:
                return '#1C1C1E'; // previous default black
        }
    })();

    const getIcon = () => {
        const iconProps = { size: 100, color: textColor, strokeWidth: 1.7 };

        switch (variant) {
            case 'success':
                return <CircleCheck {...iconProps} />;
            case 'error':
                return <CircleX {...iconProps} />;
            case 'warning':
                return <TriangleAlert {...iconProps} />;
            case 'info':
                return <Info {...iconProps} />;
            default:
                return null;
        }
    };

    const renderGlassIcon = () => {
        const icon = getIcon();
        if (!icon) {
            return null;
        }

        return <View className="absolute -right-3 top-1 opacity-50">{icon}</View>;
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

        translateY.value = withTiming(-80, { duration: 180 });
        opacity.value = withTiming(0, { duration: 180 }, finished => {
            if (finished) {
                dismissOnUiThread();
            }
        });
        scale.value = withTiming(0.9, { duration: 180 });
    }, [dismissOnUiThread]);

    useEffect(() => {
        if (!shouldDismiss) {
            return;
        }
        dismiss();
    }, [dismiss, shouldDismiss]);

    const panGesture = Gesture.Pan()
        .onUpdate(event => {
            translateX.value = event.translationX;
        })
        .onEnd(event => {
            const { translationX, velocityX } = event;

            if (Math.abs(translationX) > screenWidth * 0.25 || Math.abs(velocityX) > 800) {
                // Animate out horizontally
                translateX.value = withTiming(translationX > 0 ? screenWidth : -screenWidth, { duration: 250 });
                opacity.value = withTiming(0, { duration: 250 }, finished => {
                    if (finished) {
                        dismissOnUiThread();
                    }
                });
            } else {
                // Snap back with spring animation
                translateX.value = withSpring(0, SPRING_CONFIG);
            }
        });

    const getTopPosition = () => {
        const safeTop = Math.max(topInset, Platform.OS === 'ios' ? 8 : 12);
        return safeTop + TOAST_MARGIN + index * (EXPANDED_HEIGHT + TOAST_MARGIN);
    };

    // Animated styles
    const animatedContainerStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }, { translateX: translateX.value }, { scale: scale.value }],
    }));

    const animatedIslandStyle = useAnimatedStyle(() => ({
        width: width.value,
        height: height.value,
        borderRadius: borderRadius.value,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    }));

    const toastStyle: ViewStyle = {
        position: 'absolute',
        top: getTopPosition(),
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 1000 + index,
    };
    const gradientColors: [string, string] = [shiftHexColor(variantBackgroundColor, -16), shiftHexColor(variantBackgroundColor, 22)];
    const glassIcon = renderGlassIcon();

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={[toastStyle, animatedContainerStyle]}>
                <Animated.View style={animatedIslandStyle}>
                    <LinearGradient colors={gradientColors} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={ABSOLUTE_FILL} />

                    {/* Expanded state - full content */}
                    {isExpanded && (
                        <Animated.View className="absolute inset-0 flex-row items-center px-8 py-2.5">
                            <View className="min-w-0 flex-1">
                                {title && (
                                    <TextX
                                        variant="subtitle"
                                        style={{
                                            color: textColor,
                                            marginBottom: description ? 2 : 0,
                                        }}
                                        numberOfLines={1}
                                        ellipsizeMode="tail">
                                        {title}
                                    </TextX>
                                )}
                                {description && (
                                    <TextX
                                        variant="description"
                                        style={{
                                            color: textColor,
                                        }}
                                        numberOfLines={2}
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

                            {glassIcon}
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
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
    const insets = useSafeAreaInsets();
    const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const durationMapRef = useRef<Map<string, number>>(new Map());

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

            const duration = durationMapRef.current.get(id) ?? 4000;
            if (duration <= 0) {
                return;
            }

            const timer = setTimeout(() => {
                markToastDismissing(id);
            }, duration);
            dismissTimersRef.current.set(id, timer);
        },
        [clearDismissTimer, markToastDismissing],
    );

    const addToast = useCallback(
        (toastData: Omit<ToastData, 'id'>) => {
            const id = generateId();
            const newToast: ToastData = {
                ...toastData,
                id,
                duration: toastData.duration ?? 4000,
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
            durationMapRef.current.set(id, newToast.duration ?? 4000);
        },
        [clearDismissTimer, maxToasts],
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

    const containerStyle: ViewStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        pointerEvents: 'box-none',
    };

    return (
        <ToastContext.Provider value={contextValue}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                {children}
                <View style={containerStyle} pointerEvents="box-none">
                    {toasts.map((toast, index) => (
                        <Toast
                            key={toast.id}
                            {...toast}
                            index={index}
                            topInset={insets.top}
                            onShown={scheduleDismiss}
                            shouldDismiss={dismissingIds.has(toast.id)}
                            onDismiss={dismissToast}
                        />
                    ))}
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
