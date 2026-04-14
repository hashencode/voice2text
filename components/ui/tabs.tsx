import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import { Colors } from '@/theme/colors';
import { BORDER_RADIUS, BUTTON_HEIGHT, CORNERS } from '@/theme/globals';
import classNames from 'classnames';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ScrollView, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { TextX } from '~/components/ui/textx';

// Types
interface TabsContextType {
    activeTab: string;
    keepMounted: boolean;
    setActiveTab: (value: string) => void;
    triggerRadius: number;
    setTriggerRadius: (value: number) => void;
    orientation: 'horizontal' | 'vertical';
}

interface TabsProps {
    children: React.ReactNode;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    keepMounted?: boolean;
    orientation?: 'horizontal' | 'vertical';
    className?: string;
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
    keepMounted?: boolean;
    className?: string;
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
    keepMounted = false,
    orientation = 'horizontal',
    className,
    style,
}: TabsProps) {
    const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState(defaultValue);
    const [triggerRadius, setTriggerRadiusState] = useState(CORNERS);

    // Determine if we're in controlled or uncontrolled mode
    const isControlled = value !== undefined;
    const activeTab = isControlled ? value : uncontrolledActiveTab;

    const setActiveTab = React.useCallback(
        (newValue: string) => {
            if (newValue === activeTab) {
                return;
            }
            if (!isControlled) {
                setUncontrolledActiveTab(newValue);
            }
            onValueChange?.(newValue);
        },
        [activeTab, isControlled, onValueChange],
    );

    const setTriggerRadius = React.useCallback((newRadius: number) => {
        setTriggerRadiusState(prev => {
            if (prev === newRadius) {
                return prev;
            }
            return newRadius;
        });
    }, []);

    const normalizedChildren = React.useMemo(() => normalizeChildren(children), [children]);
    const contextValue = React.useMemo(
        () => ({
            activeTab,
            keepMounted,
            setActiveTab,
            triggerRadius,
            setTriggerRadius,
            orientation,
        }),
        [activeTab, keepMounted, orientation, setActiveTab, setTriggerRadius, triggerRadius],
    );

    return (
        <TabsContext.Provider value={contextValue}>
            <View className={classNames(orientation === 'horizontal' ? 'flex-col' : 'flex-row', className)} style={style}>
                {normalizedChildren}
            </View>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, style, scrollable = false, radius }: TabsListProps) {
    const { orientation, setTriggerRadius } = useTabsContext();
    const backgroundColor = useColor('muted');
    const resolvedRadius = radius ?? (orientation === 'horizontal' ? CORNERS : BORDER_RADIUS);
    const normalizedChildren = React.useMemo(() => normalizeChildren(children), [children]);

    useEffect(() => {
        setTriggerRadius(resolvedRadius);
    }, [resolvedRadius, setTriggerRadius]);

    return (
        <View
            accessibilityRole="tablist"
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
                    {normalizedChildren}
                </View>
            )}
        </View>
    );
}

export function TabsTrigger({ children, value, disabled = false, className, style, textStyle, icon, iconProps }: TabsTriggerProps) {
    const { activeTab, setActiveTab, triggerRadius, orientation } = useTabsContext();
    const isActive = activeTab === value;

    const activeBackgroundColor = useColor('primary');
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
        backgroundColor: isActive ? activeBackgroundColor : 'transparent',
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
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled }}>
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

export function TabsContent({ children, value, keepMounted, className, style }: TabsContentProps) {
    const { activeTab, keepMounted: keepMountedFromTabs } = useTabsContext();
    const isActive = activeTab === value;
    const shouldKeepMounted = keepMounted ?? keepMountedFromTabs;

    if (!isActive && !shouldKeepMounted) {
        return null;
    }

    const hiddenMountedStyle: ViewStyle | null =
        !isActive && shouldKeepMounted
            ? {
                  position: 'absolute',
                  left: -100000,
                  top: 0,
                  width: 1,
                  height: 1,
                  opacity: 0,
              }
            : null;

    return (
        <View
            className={classNames('pt-4', className)}
            style={[style, hiddenMountedStyle]}
            pointerEvents={!isActive && shouldKeepMounted ? 'none' : 'auto'}
            accessibilityElementsHidden={!isActive && shouldKeepMounted}
            importantForAccessibility={!isActive && shouldKeepMounted ? 'no-hide-descendants' : 'auto'}>
            {children}
        </View>
    );
}
