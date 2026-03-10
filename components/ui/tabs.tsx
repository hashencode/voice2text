import { TextX } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import { BORDER_RADIUS, BUTTON_HEIGHT, CORNERS, FONT_SIZE } from '@/theme/globals';
import classNames from 'classnames';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ScrollView, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

// Types
interface TabsContextType {
    activeTab: string;
    setActiveTab: (value: string) => void;
    orientation: 'horizontal' | 'vertical';
}

interface TabsProps {
    children: React.ReactNode;
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    orientation?: 'horizontal' | 'vertical';
    style?: ViewStyle;
}

interface TabsListProps {
    children: React.ReactNode;
    style?: ViewStyle;
    scrollable?: boolean;
}

interface TabsTriggerProps {
    children: React.ReactNode;
    value: string;
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
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

export function Tabs({ children, defaultValue = '', value, onValueChange, orientation = 'horizontal', style }: TabsProps) {
    const [internalActiveTab, setInternalActiveTab] = useState(defaultValue);

    // Determine if we're in controlled or uncontrolled mode
    const isControlled = value !== undefined;
    const activeTab = isControlled ? value : internalActiveTab;

    // Update internal state when value prop changes (controlled mode)
    useEffect(() => {
        if (isControlled && value !== internalActiveTab) {
            setInternalActiveTab(value);
        }
    }, [value, isControlled, internalActiveTab]);

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

    return (
        <TabsContext.Provider
            value={{
                activeTab,
                setActiveTab,
                orientation,
            }}>
            <View className={orientation === 'horizontal' ? 'flex-col' : 'flex-row'} style={style}>
                {children}
            </View>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, style, scrollable = false }: TabsListProps) {
    const { orientation } = useTabsContext();
    const backgroundColor = useColor('muted');

    return (
        <View
            className="p-1.5"
            style={[
                {
                    backgroundColor,
                    borderRadius: orientation === 'horizontal' ? CORNERS : BORDER_RADIUS,
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
                    {children}
                </ScrollView>
            ) : (
                <View className={orientation === 'horizontal' ? 'w-full flex-row items-center' : 'flex-col items-center'}>{children}</View>
            )}
        </View>
    );
}

export function TabsTrigger({ children, value, disabled = false, style, textStyle }: TabsTriggerProps) {
    const { activeTab, setActiveTab, orientation } = useTabsContext();
    const isActive = activeTab === value;

    const primaryColor = useColor('primary');
    const mutedForegroundColor = useColor('mutedForeground');
    const backgroundColor = useColor('background');

    const handlePress = () => {
        if (!disabled) {
            setActiveTab(value);
        }
    };

    const triggerStyle: ViewStyle = {
        borderRadius: CORNERS,
        minHeight: BUTTON_HEIGHT,
        backgroundColor: isActive ? backgroundColor : 'transparent',
        opacity: disabled ? 0.5 : 1,
        width: 500,
        ...style,
    };

    const triggerTextStyle: TextStyle = {
        fontSize: FONT_SIZE,
        fontWeight: '500',
        color: isActive ? primaryColor : mutedForegroundColor,
        textAlign: 'center',
        ...textStyle,
    };

    return (
        <TouchableOpacity
            className={classNames('items-center justify-center px-3', {
                'flex-1': orientation === 'horizontal',
                'mb-1 py-2': orientation === 'vertical',
            })}
            style={triggerStyle}
            onPress={handlePress}
            disabled={disabled}
            activeOpacity={0.8}>
            {typeof children === 'string' ? <TextX style={triggerTextStyle}>{children}</TextX> : children}
        </TouchableOpacity>
    );
}

export function TabsContent({ children, value, style }: TabsContentProps) {
    const { activeTab } = useTabsContext();
    const isActive = activeTab === value;

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
