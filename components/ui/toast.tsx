import { TextX } from '@/components/ui/textx';
import { Spinner } from '@/components/ui/spinner';
import { useColor } from '@/hooks/useColor';
import type { LucideProps } from 'lucide-react-native';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react-native';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPreset = 'overlay' | 'compact';
export type ToastInteractionMode = 'masked' | 'passthrough';

export interface ToastData {
    id: string;
    message?: string;
    title?: string;
    description?: string;
    variant?: ToastVariant;
    icon?: React.ReactNode;
    preset?: ToastPreset;
    interactionMode?: ToastInteractionMode;
    showBackdrop?: boolean;
    durationMs?: number;
    persistent?: boolean;
    action?: {
        label: string;
        onPress: () => void;
    };
}

interface ToastProps extends ToastData {
    onDismiss: (id: string) => void;
    index: number;
    shouldDismiss: boolean;
}

const VARIANT_ICON: Partial<Record<ToastVariant, React.ComponentType<LucideProps>>> = {
    success: CircleCheck,
    error: CircleX,
    warning: TriangleAlert,
    info: Info,
};

const TOAST_TIMING = {
    enterDuration: 180,
    exitDuration: 160,
} as const;

const TOAST_DURATION_BY_VARIANT: Record<ToastVariant, number> = {
    default: 2200,
    success: 2200,
    warning: 4400,
    info: 2200,
    error: 4400,
    loading: 0,
};

export function Toast({
    id,
    message,
    title,
    description,
    variant = 'default',
    icon,
    preset = 'compact',
    interactionMode,
    onDismiss,
    index,
    shouldDismiss,
}: ToastProps) {
    const displayMessage = message ?? title ?? description ?? '';
    const primaryColor = useColor('primary');
    const successColor = '#22c55e';
    const warningColor = '#f59e0b';
    const errorColor = '#ef4444';
    const infoColor = '#3b82f6';
    const toastBackgroundColor = useColor('card', { light: 'rgba(0, 0, 0, 0.9)', dark: 'rgba(255,255,255, 0.9)' });
    const toastTextColor = useColor('text', { reverse: true });
    const iconColorByVariant: Record<ToastVariant, string> = {
        default: primaryColor,
        success: successColor,
        warning: warningColor,
        error: errorColor,
        info: infoColor,
        loading: toastTextColor,
    };
    const isOverlay = preset === 'overlay';
    const defaultInteractionMode: ToastInteractionMode = isOverlay ? 'masked' : 'passthrough';
    const resolvedInteractionMode = interactionMode ?? defaultInteractionMode;
    const hasMask = resolvedInteractionMode === 'masked';
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(6)).current;
    const isExitingRef = useRef(false);

    const runExitAnimation = useCallback(() => {
        if (isExitingRef.current) {
            return;
        }
        isExitingRef.current = true;
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: TOAST_TIMING.exitDuration,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -4,
                duration: TOAST_TIMING.exitDuration,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (!finished) {
                return;
            }
            onDismiss(id);
        });
    }, [id, onDismiss, opacity, translateY]);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: TOAST_TIMING.enterDuration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: TOAST_TIMING.enterDuration,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [opacity, translateY]);

    useEffect(() => {
        if (!shouldDismiss) {
            return;
        }
        runExitAnimation();
    }, [runExitAnimation, shouldDismiss]);

    const getIcon = (iconSize: number, strokeWidth: number) => {
        const IconComponent = VARIANT_ICON[variant];
        if (!IconComponent) {
            return null;
        }
        return <IconComponent size={iconSize} color={iconColorByVariant[variant]} strokeWidth={strokeWidth} />;
    };

    const loadingIconNode =
        variant === 'loading' ? <Spinner variant="bars" size={isOverlay ? 'lg' : 'sm'} color={iconColorByVariant.loading} /> : null;
    const variantIconNode = loadingIconNode ?? getIcon(isOverlay ? 56 : 18, isOverlay ? 1.5 : 2);
    const iconNode = icon ?? variantIconNode;

    return (
        <View pointerEvents={hasMask ? 'auto' : 'box-none'} className="absolute inset-0" style={{ zIndex: 1000 + index }}>
            {hasMask ? <Pressable className="absolute inset-0" onPress={() => {}} /> : null}

            <View pointerEvents="box-none" className="absolute inset-0 items-center justify-center px-4">
                <Animated.View
                    style={{
                        opacity,
                        transform: [{ translateY }],
                    }}>
                    {isOverlay ? (
                        <View
                            className="h-52 w-60 items-center justify-center rounded-2xl p-6"
                            style={{ backgroundColor: toastBackgroundColor }}>
                            {iconNode ? <View className="mb-3.5">{iconNode}</View> : null}
                            <TextX variant="subtitle" className="text-center" style={{ color: toastTextColor }}>
                                {displayMessage}
                            </TextX>
                        </View>
                    ) : (
                        <View
                            className="min-h-10 max-w-[80%] flex-row items-center rounded-xl px-4 py-3"
                            style={{ backgroundColor: toastBackgroundColor }}>
                            {iconNode ? <View className="mr-2">{iconNode}</View> : null}
                            <TextX variant="body" className="leading-5" style={{ color: toastTextColor }}>
                                {displayMessage}
                            </TextX>
                        </View>
                    )}
                </Animated.View>
            </View>
        </View>
    );
}

interface ToastContextType {
    toast: (toast: Omit<ToastData, 'id'>) => string;
    loading: (message: string, options?: Omit<ToastData, 'id' | 'message' | 'variant'>) => string;
    updateToast: (id: string, patch: Partial<Omit<ToastData, 'id'>>) => void;
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
    const dismissTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const durationMapRef = useRef<Map<string, number>>(new Map());
    const resolveDuration = useCallback((variant?: ToastVariant) => TOAST_DURATION_BY_VARIANT[variant ?? 'default'], []);
    const resolveToastDuration = useCallback(
        (toastData: Omit<ToastData, 'id'>) => {
            if (typeof toastData.durationMs === 'number') {
                return Math.max(0, toastData.durationMs);
            }
            if (toastData.persistent || toastData.variant === 'loading') {
                return 0;
            }
            return resolveDuration(toastData.variant);
        },
        [resolveDuration],
    );

    const generateId = () => Math.random().toString(36).slice(2, 11);

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

    const requestDismiss = useCallback(
        (id: string) => {
            clearDismissTimer(id);
            markToastDismissing(id);
        },
        [clearDismissTimer, markToastDismissing],
    );

    const scheduleDismiss = useCallback(
        (id: string) => {
            clearDismissTimer(id);
            const duration = durationMapRef.current.get(id) ?? TOAST_DURATION_BY_VARIANT.default;
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
            };

            durationMapRef.current.set(id, resolveToastDuration(newToast));

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

            scheduleDismiss(id);
            return id;
        },
        [clearDismissTimer, maxToasts, resolveToastDuration, scheduleDismiss],
    );

    const updateToast = useCallback(
        (id: string, patch: Partial<Omit<ToastData, 'id'>>) => {
            let nextToast: ToastData | null = null;
            setToasts(prev =>
                prev.map(current => {
                    if (current.id !== id) {
                        return current;
                    }
                    nextToast = { ...current, ...patch };
                    return nextToast;
                }),
            );
            if (!nextToast) {
                return;
            }
            durationMapRef.current.set(id, resolveToastDuration(nextToast));
            setDismissingIds(prev => {
                if (!prev.has(id)) {
                    return prev;
                }
                const nextIds = new Set(prev);
                nextIds.delete(id);
                return nextIds;
            });
            scheduleDismiss(id);
        },
        [resolveToastDuration, scheduleDismiss],
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

    useEffect(() => {
        return () => {
            dismissTimersRef.current.forEach(timer => {
                clearTimeout(timer);
            });
            dismissTimersRef.current.clear();
            durationMapRef.current.clear();
        };
    }, []);

    const createVariantToast = useCallback(
        (variant: ToastVariant, title: string, description?: string) => {
            addToast({
                message: title,
                description,
                variant,
            });
        },
        [addToast],
    );

    const contextValue: ToastContextType = {
        toast: addToast,
        loading: (message, options) =>
            addToast({
                message,
                variant: 'loading',
                preset: 'overlay',
                interactionMode: 'masked',
                persistent: true,
                ...options,
            }),
        updateToast,
        success: (title, description) => createVariantToast('success', title, description),
        error: (title, description) => createVariantToast('error', title, description),
        warning: (title, description) => createVariantToast('warning', title, description),
        info: (title, description) => createVariantToast('info', title, description),
        dismiss: requestDismiss,
        dismissAll,
    };

    return (
        <ToastContext.Provider value={contextValue}>
            <GestureHandlerRootView className="flex-1">
                {children}
                <View className="absolute inset-0" pointerEvents="box-none">
                    {toasts.map((toast, index) => (
                        <Toast
                            key={toast.id}
                            {...toast}
                            index={index}
                            shouldDismiss={dismissingIds.has(toast.id)}
                            onDismiss={dismissToast}
                        />
                    ))}
                </View>
            </GestureHandlerRootView>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
