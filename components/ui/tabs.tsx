import { GradientBackground } from '@/components/ui/gradient-background';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import { Colors } from '@/theme/colors';
import { BORDER_RADIUS, BUTTON_HEIGHT, CORNERS } from '@/theme/globals';
import classNames from 'classnames';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ScrollView, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { TextX } from '~/components/ui/textx';

// Types
interface TabsContextType {
    activeTab: string;
    contentTab: string;
    setActiveTab: (value: string) => void;
    triggerRadius: number;
    setTriggerRadius: (value: number) => void;
    setTriggerLayout: (value: string, layout: { x: number; width: number }) => void;
    triggerLayouts: Record<string, { x: number; width: number }>;
    orientation: 'horizontal' | 'vertical';
}

interface TabsProps {
    children: React.ReactNode;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    contentSwitchDelayMs?: number;
    orientation?: 'horizontal' | 'vertical';
    style?: ViewStyle;
}

interface TabsListProps {
    children: React.ReactNode;
    style?: ViewStyle;
    scrollable?: boolean;
    radius?: number;
}

interface TabsTriggerProps {
    children: React.ReactNode;
    value: string;
    disabled?: boolean;
    className?: string;
    style?: ViewStyle;
    textStyle?: TextStyle;
    icon?: React.ComponentType<Record<string, unknown>>;
    iconProps?: Record<string, unknown>;
}

interface TabsContentProps {
    children: React.ReactNode;
    value: string;
    style?: ViewStyle;
}

// Context
const TabsContext = createContext<TabsContextType | undefined>(undefined);

const useTabsContext = () => {
    const context = useContext(TabsContext);
    if (!context) {
        throw new Error('Tabs components must be used within a Tabs provider');
    }
    return context;
};

function normalizeChildren(children: React.ReactNode): React.ReactNode[] {
    return React.Children.toArray(children).filter(child => !(typeof child === 'string' && child.trim().length === 0));
}

export function Tabs({
    children,
    defaultValue = '',
    value,
    onValueChange,
    contentSwitchDelayMs = 0,
    orientation = 'horizontal',
    style,
}: TabsProps) {
    const [internalActiveTab, setInternalActiveTab] = useState(defaultValue);
    const [contentTab, setContentTab] = useState(defaultValue);
    const [triggerRadius, setTriggerRadiusState] = useState(CORNERS);
    const [triggerLayouts, setTriggerLayouts] = useState<Record<string, { x: number; width: number }>>({});
    const pendingLayoutsRef = React.useRef<Record<string, { x: number; width: number }>>({});
    const layoutFlushFrameRef = React.useRef<number | null>(null);

    // Determine if we're in controlled or uncontrolled mode
    const isControlled = value !== undefined;
    const activeTab = isControlled ? value : internalActiveTab;

    // Update internal state when value prop changes (controlled mode)
    useEffect(() => {
        if (isControlled && value !== internalActiveTab) {
            setInternalActiveTab(value);
        }
    }, [value, isControlled, internalActiveTab]);

    useEffect(() => {
        if (contentSwitchDelayMs <= 0) {
            setContentTab(activeTab);
            return;
        }

        const timer = setTimeout(() => {
            setContentTab(activeTab);
        }, contentSwitchDelayMs);

        return () => {
            clearTimeout(timer);
        };
    }, [activeTab, contentSwitchDelayMs]);

    const setActiveTab = (newValue: string) => {
        if (!isControlled) {
            // Uncontrolled mode: update internal state
            setInternalActiveTab(newValue);
        }

        // Call onValueChange callback if provided (works in both controlled and uncontrolled modes)
        if (onValueChange) {
            onValueChange(newValue);
        }
    };
    const setTriggerRadius = React.useCallback((newRadius: number) => {
        setTriggerRadiusState(prev => {
            if (prev === newRadius) {
                return prev;
            }
            return newRadius;
        });
    }, []);
    const flushPendingLayouts = React.useCallback(() => {
        layoutFlushFrameRef.current = null;
        const pending = pendingLayoutsRef.current;
        pendingLayoutsRef.current = {};
        const pendingEntries = Object.entries(pending);
        if (pendingEntries.length === 0) {
            return;
        }

        setTriggerLayouts(prev => {
            let changed = false;
            const next = { ...prev };

            for (const [tabValue, layout] of pendingEntries) {
                const current = prev[tabValue];
                if (!current || Math.abs(current.x - layout.x) >= 1 || Math.abs(current.width - layout.width) >= 1) {
                    next[tabValue] = layout;
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, []);

    const setTriggerLayout = React.useCallback(
        (tabValue: string, layout: { x: number; width: number }) => {
            if (layout.width <= 0) {
                return;
            }

            pendingLayoutsRef.current[tabValue] = {
                x: layout.x,
                width: layout.width,
            };

            if (layoutFlushFrameRef.current !== null) {
                return;
            }
            layoutFlushFrameRef.current = requestAnimationFrame(flushPendingLayouts);
        },
        [flushPendingLayouts],
    );

    useEffect(() => {
        return () => {
            if (layoutFlushFrameRef.current !== null) {
                cancelAnimationFrame(layoutFlushFrameRef.current);
                layoutFlushFrameRef.current = null;
            }
        };
    }, []);

    const normalizedChildren = React.useMemo(() => normalizeChildren(children), [children]);

    return (
        <TabsContext.Provider
            value={{
                activeTab,
                contentTab,
                setActiveTab,
                triggerRadius,
                setTriggerRadius,
                setTriggerLayout,
                triggerLayouts,
                orientation,
            }}>
            <View className={orientation === 'horizontal' ? 'flex-col' : 'flex-row'} style={style}>
                {normalizedChildren}
            </View>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, style, scrollable = false, radius }: TabsListProps) {
    const { orientation, activeTab, triggerLayouts, setTriggerRadius } = useTabsContext();
    const backgroundColor = useColor('muted');
    const highlightColor = useColor('primary');
    const resolvedRadius = radius ?? (orientation === 'horizontal' ? CORNERS : BORDER_RADIUS);
    const indicatorX = useSharedValue(0);
    const indicatorWidth = useSharedValue(0);
    const [indicatorReady, setIndicatorReady] = React.useState(false);
    const isSlidingIndicatorEnabled = orientation === 'horizontal' && !scrollable;
    const activeLayout = triggerLayouts[activeTab];
    const normalizedChildren = React.useMemo(() => normalizeChildren(children), [children]);

    useEffect(() => {
        setTriggerRadius(resolvedRadius);
    }, [resolvedRadius, setTriggerRadius]);

    useEffect(() => {
        if (!isSlidingIndicatorEnabled || !activeLayout) {
            return;
        }

        if (!indicatorReady) {
            indicatorX.value = activeLayout.x;
            indicatorWidth.value = activeLayout.width;
            setIndicatorReady(true);
            return;
        }

        indicatorX.value = withSpring(activeLayout.x, {
            damping: 22,
            stiffness: 250,
            mass: 0.8,
            overshootClamping: false,
        });
        // Keep width snapping instead of animating to reduce frame workload.
        indicatorWidth.value = activeLayout.width;
    }, [activeLayout, indicatorReady, indicatorWidth, indicatorX, isSlidingIndicatorEnabled]);

    const indicatorAnimatedStyle = useAnimatedStyle(() => {
        return {
            width: indicatorWidth.value,
            transform: [{ translateX: indicatorX.value }],
        };
    });

    return (
        <View
            className="p-1.5"
            style={[
                {
                    backgroundColor,
                    borderRadius: resolvedRadius,
                },
                style,
            ]}>
            {scrollable ? (
                <ScrollView
                    horizontal={orientation === 'horizontal'}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
                        alignItems: 'center',
                    }}>
                    {normalizedChildren}
                </ScrollView>
            ) : (
                <View
                    className={classNames(
                        'relative',
                        orientation === 'horizontal' ? 'w-full flex-row items-center' : 'flex-col items-center',
                    )}>
                    {isSlidingIndicatorEnabled && indicatorReady ? (
                        <Animated.View
                            pointerEvents="none"
                            style={[
                                {
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                borderRadius: resolvedRadius,
                                overflow: 'hidden',
                                },
                                indicatorAnimatedStyle,
                            ]}>
                            <GradientBackground
                                baseColor={highlightColor}
                                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                            />
                        </Animated.View>
                    ) : null}
                    {normalizedChildren}
                </View>
            )}
        </View>
    );
}

export function TabsTrigger({ children, value, disabled = false, className, style, textStyle, icon, iconProps }: TabsTriggerProps) {
    const { activeTab, setActiveTab, triggerRadius, orientation, setTriggerLayout } = useTabsContext();
    const isActive = activeTab === value;

    const mutedForegroundColor = useColor('mutedForeground');
    const activeTextColor = Colors.dark.text;

    const handlePress = () => {
        if (!disabled) {
            setActiveTab(value);
        }
    };

    const triggerStyle: ViewStyle = {
        borderRadius: triggerRadius,
        minHeight: BUTTON_HEIGHT,
        backgroundColor: 'transparent',
        opacity: disabled ? 0.5 : 1,
        zIndex: 1,
        ...style,
    };

    const triggerTextStyle: TextStyle = {
        fontWeight: '500',
        color: isActive ? activeTextColor : mutedForegroundColor,
        textAlign: 'center',
        ...textStyle,
    };
    const triggerTextColor =
        typeof triggerTextStyle.color === 'string' ? triggerTextStyle.color : isActive ? activeTextColor : mutedForegroundColor;
    const IconComp = icon;

    return (
        <TouchableOpacity
            className={classNames(
                'items-center justify-center px-3 py-2',
                {
                    'flex-1': orientation === 'horizontal',
                    'mb-1 py-2': orientation === 'vertical',
                },
                className,
            )}
            style={triggerStyle}
            onPress={handlePress}
            disabled={disabled}
            activeOpacity={0.8}
            onLayout={event => {
                const { x, width } = event.nativeEvent.layout;
                setTriggerLayout(value, { x, width });
            }}>
            {typeof children === 'string' ? (
                <View className={icon ? 'flex-row items-center gap-1.5' : undefined}>
                    {IconComp ? <IconComp {...(iconProps ?? {})} color={triggerTextColor} /> : null}
                    <TextX style={triggerTextStyle}>{children}</TextX>
                </View>
            ) : (
                children
            )}
        </TouchableOpacity>
    );
}

export function TabsContent({ children, value, style }: TabsContentProps) {
    const { contentTab } = useTabsContext();
    const isActive = contentTab === value;

    // Regular mode - only render active content
    if (!isActive) {
        return null;
    }

    return (
        <View className="pt-4" style={style}>
            {children}
        </View>
    );
}
