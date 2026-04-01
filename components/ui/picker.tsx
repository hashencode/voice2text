import { Icon } from '@/components/ui/icon';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ModalMask } from '@/components/ui/modal-mask';
import { TextX } from '@/components/ui/textx';
import { View } from '@/components/ui/view';
import { acquireOverlayInteractionLock } from '@/hooks/use-overlay-interaction-lock';
import { useColor } from '@/hooks/useColor';
import {
    BORDER_RADIUS,
    BUTTON_HEIGHT,
    BUTTON_ICON,
    BUTTON_PADDING_HORIZON,
    BUTTON_PADDING_HORIZON_LG,
    BUTTON_PADDING_HORIZON_SM,
    FONT_SIZE_SM,
} from '@/theme/globals';
import { ChevronDown, LucideProps } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, TextStyle, TouchableOpacity, ViewStyle, useWindowDimensions } from 'react-native';

export interface PickerOption {
    label: string;
    value: string;
    description?: string;
    disabled?: boolean;
}

export interface PickerSection {
    title?: string;
    options: PickerOption[];
}

interface PickerProps {
    options?: PickerOption[];
    sections?: PickerSection[];
    value?: string;
    placeholder?: string;
    error?: string;
    variant?: 'outline' | 'filled' | 'group';
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    style?: ViewStyle;
    multiple?: boolean;
    values?: string[];
    onValuesChange?: (values: string[]) => void;

    // Styling props
    label?: string;
    icon?: React.ComponentType<LucideProps>;
    rightComponent?: React.ReactNode | (() => React.ReactNode);
    inputStyle?: TextStyle;
    labelStyle?: TextStyle;
    errorStyle?: TextStyle;

    // Modal props
    modalTitle?: string;
    modalMaxHeightRatio?: number;
    optionsHeight?: number;
    triggerActiveOpacity?: number;
    optionActiveOpacity?: number;
    onOpenChange?: (open: boolean) => void;
    okText?: string;
}

export function Picker({
    options = [],
    sections = [],
    value,
    values = [],
    error,
    variant = 'filled',
    placeholder = 'Select an option...',
    onValueChange,
    onValuesChange,
    disabled = false,
    style,
    multiple = false,
    label,
    icon,
    rightComponent,
    inputStyle,
    labelStyle,
    errorStyle,
    modalTitle,
    optionsHeight,
    triggerActiveOpacity = 0.8,
    optionActiveOpacity = 0.8,
    onOpenChange,
    okText = 'OK',
}: PickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const lockReleaseRef = React.useRef<(() => void) | null>(null);
    const { height: screenHeight } = useWindowDimensions();

    // Move ALL theme color hooks to the top level
    const borderColor = useColor('border');
    const text = useColor('text');
    const muted = useColor('mutedForeground');
    const cardColor = useColor('card');
    const danger = useColor('red');
    const primary = useColor('primary');
    const primaryForeground = useColor('primaryForeground');
    const textMutedColor = useColor('textMuted');

    // Normalize data structure - convert options to sections format
    const normalizedSections: PickerSection[] = sections.length > 0 ? sections : [{ options }];

    const filteredSections = normalizedSections;
    const totalOptionsCount = filteredSections.reduce((count, section) => count + section.options.length, 0);
    const resolvedOptionsHeight = optionsHeight ?? (totalOptionsCount <= 4 ? 300 : Math.round(screenHeight * 0.5));

    // Get selected options for display
    const getSelectedOptions = () => {
        const allOptions = normalizedSections.flatMap(section => section.options);

        if (multiple) {
            return allOptions.filter(option => values.includes(option.value));
        } else {
            return allOptions.filter(option => option.value === value);
        }
    };

    const selectedOptions = getSelectedOptions();

    const setOpen = (open: boolean) => {
        if (open) {
            if (!lockReleaseRef.current) {
                lockReleaseRef.current = acquireOverlayInteractionLock();
            }
        } else if (lockReleaseRef.current) {
            lockReleaseRef.current();
            lockReleaseRef.current = null;
        }
        setIsOpen(open);
        onOpenChange?.(open);
    };

    React.useEffect(() => {
        return () => {
            if (lockReleaseRef.current) {
                lockReleaseRef.current();
                lockReleaseRef.current = null;
            }
        };
    }, []);

    const handleSelect = (optionValue: string) => {
        if (multiple) {
            const newValues = values.includes(optionValue) ? values.filter(v => v !== optionValue) : [...values, optionValue];
            onValuesChange?.(newValues);
        } else {
            onValueChange?.(optionValue);
            setOpen(false);
        }
    };

    const getDisplayText = () => {
        if (selectedOptions.length === 0) return placeholder;

        if (multiple) {
            if (selectedOptions.length === 1) {
                return selectedOptions[0].label;
            }
            return `${selectedOptions.length} selected`;
        }

        return selectedOptions[0]?.label || placeholder;
    };

    const triggerStyle: ViewStyle = {
        paddingHorizontal: variant === 'group' ? 0 : BUTTON_PADDING_HORIZON,
        borderWidth: variant === 'group' ? 0 : 1,
        borderColor: variant === 'outline' ? borderColor : cardColor,
        backgroundColor: variant === 'filled' ? cardColor : 'transparent',
        minHeight: variant === 'group' ? 'auto' : BUTTON_HEIGHT,
        opacity: disabled ? 0.5 : 1,
    };

    const renderOption = (option: PickerOption, sectionIndex: number, optionIndex: number) => {
        const isSelected = multiple ? values.includes(option.value) : value === option.value;

        return (
            <TouchableOpacity
                key={`${sectionIndex}-${option.value}`}
                onPress={() => !option.disabled && handleSelect(option.value)}
                className="my-0.5 overflow-hidden rounded-full"
                style={{
                    opacity: option.disabled ? 0.3 : 1,
                }}
                disabled={option.disabled}
                activeOpacity={optionActiveOpacity}>
                {isSelected ? (
                    <GradientBackground
                        baseColor={primary}
                        style={{ paddingVertical: BUTTON_PADDING_HORIZON_SM, paddingHorizontal: BUTTON_PADDING_HORIZON_LG }}>
                        <View className="w-full items-center">
                            <TextX
                                className="text-center"
                                style={{
                                    color: primaryForeground,
                                    fontWeight: '600',
                                }}>
                                {option.label}
                            </TextX>
                            {option.description && (
                                <TextX
                                    variant="subtitle"
                                    className="mt-1 text-center"
                                    style={{
                                        fontSize: FONT_SIZE_SM,
                                        color: primaryForeground,
                                    }}>
                                    {option.description}
                                </TextX>
                            )}
                        </View>
                    </GradientBackground>
                ) : (
                    <View style={{ paddingVertical: BUTTON_PADDING_HORIZON_SM, paddingHorizontal: BUTTON_PADDING_HORIZON_LG }}>
                        <View className="w-full items-center">
                            <TextX
                                className="text-center"
                                style={{
                                    color: text,
                                    fontWeight: '400',
                                }}>
                                {option.label}
                            </TextX>
                            {option.description && (
                                <TextX
                                    variant="subtitle"
                                    className="mt-1 text-center"
                                    style={{
                                        fontSize: FONT_SIZE_SM,
                                        color: textMutedColor,
                                    }}>
                                    {option.description}
                                </TextX>
                            )}
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <>
            <TouchableOpacity
                className="w-full flex-row items-center rounded-full"
                style={[triggerStyle, style]}
                onPress={() => !disabled && setOpen(true)}
                disabled={disabled}
                activeOpacity={triggerActiveOpacity}>
                {/* Icon & Label */}
                <View className="mr-1.5 flex-row items-center gap-x-1" pointerEvents="none">
                    {icon && <Icon name={icon} size={BUTTON_ICON} />}
                    {label && (
                        <TextX numberOfLines={1} ellipsizeMode="tail" style={labelStyle} pointerEvents="none">
                            {label}
                        </TextX>
                    )}
                </View>

                <View className="flex-1 flex-row items-center justify-between">
                    <TextX
                        className="flex-shrink flex-grow"
                        style={[
                            {
                                color: selectedOptions.length > 0 ? text : disabled ? muted : error ? danger : muted,
                            },
                            inputStyle,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {getDisplayText()}
                    </TextX>

                    <View className="flex-shrink-0">
                        {rightComponent ? (
                            typeof rightComponent === 'function' ? (
                                rightComponent()
                            ) : (
                                rightComponent
                            )
                        ) : (
                            <ChevronDown size={BUTTON_ICON} color={error ? danger : muted} />
                        )}
                    </View>
                </View>
            </TouchableOpacity>

            {/* Error message */}
            {error && (
                <TextX
                    variant="subtitle"
                    className="mt-1"
                    style={[
                        {
                            color: danger,
                        },
                        errorStyle,
                    ]}>
                    {error}
                </TextX>
            )}

            <ModalMask isVisible={isOpen} onPressMask={() => setOpen(false)} statusBarTranslucent contentTransitionPreset="slide-up">
                <View className="flex-1 justify-end">
                    <View
                        className="w-full overflow-hidden pb-8"
                        style={{
                            backgroundColor: cardColor,
                            borderTopStartRadius: BORDER_RADIUS,
                            borderTopEndRadius: BORDER_RADIUS,
                        }}>
                        {/* Header */}
                        {(modalTitle || multiple) && (
                            <View
                                className="flex-row items-center justify-between p-4 pt-5"
                                style={{
                                    borderBottomWidth: 1,
                                    borderBottomColor: borderColor,
                                }}>
                                <TextX variant="subtitle">{modalTitle || 'Select Options'}</TextX>

                                {multiple && (
                                    <TouchableOpacity onPress={() => setOpen(false)}>
                                        <TextX
                                            style={{
                                                color: primary,
                                                fontWeight: '500',
                                            }}>
                                            {okText}
                                        </TextX>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {/* Options - Updated to match date-picker styling */}
                        <View style={{ height: resolvedOptionsHeight }}>
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ padding: BUTTON_PADDING_HORIZON }}
                                nestedScrollEnabled
                                keyboardShouldPersistTaps="handled"
                                directionalLockEnabled
                                scrollEventThrottle={16}>
                                {filteredSections.map((section, sectionIndex) => (
                                    <View key={sectionIndex}>
                                        {section.title && (
                                            <View className="mb-1 p-1">
                                                <TextX variant="description">{section.title}</TextX>
                                            </View>
                                        )}
                                        {section.options.map((option, optionIndex) => renderOption(option, sectionIndex, optionIndex))}
                                    </View>
                                ))}

                                {filteredSections.every(section => section.options.length === 0) && (
                                    <View className="items-center px-4 py-6">
                                        <TextX
                                            variant="subtitle"
                                            style={{
                                                color: textMutedColor,
                                            }}>
                                            No options available
                                        </TextX>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </View>
            </ModalMask>
        </>
    );
}
