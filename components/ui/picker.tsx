import { Icon } from '@/components/ui/icon';
import { ModalMask } from '@/components/ui/modal-mask';
import { TextX } from '@/components/ui/textx';
import { View } from '@/components/ui/view';
import { acquireOverlayInteractionLock } from '@/hooks/use-overlay-interaction-lock';
import { useColor } from '@/hooks/use-color';
import { BORDER_RADIUS, BUTTON_ICON } from '@/theme/globals';
import { Check, LucideProps } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextStyle, TouchableOpacity, ViewStyle, useWindowDimensions } from 'react-native';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';

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
    cancelText?: string;
    showCancelButton?: boolean;
}

export function Picker({
    options = [],
    sections = [],
    value,
    values = [],
    error,
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
    okText = '确定',
    cancelText = '取消',
    showCancelButton = true,
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

    const renderOption = (option: PickerOption, sectionIndex: number, optionIndex: number, isLastOption: boolean) => {
        const isSelected = multiple ? values.includes(option.value) : value === option.value;

        return (
            <TouchableOpacity
                key={`${sectionIndex}-${option.value}`}
                onPress={() => !option.disabled && handleSelect(option.value)}
                className="overflow-hidden rounded-lg"
                style={{
                    opacity: option.disabled ? 0.3 : 1,
                    borderBottomWidth: isLastOption ? 0 : StyleSheet.hairlineWidth,
                    borderBottomColor: borderColor,
                }}
                disabled={option.disabled}
                activeOpacity={optionActiveOpacity}>
                <View className="w-full flex-row items-center justify-between p-5">
                    <View>
                        <TextX className="text-center">{option.label}</TextX>
                        {option.description && (
                            <TextX variant="description" className="mt-0.5">
                                {option.description}
                            </TextX>
                        )}
                    </View>
                    {isSelected ? <Check color={primary} /> : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <TouchableOpacity
                className="w-full flex-row items-center"
                style={[{ opacity: disabled ? 0.5 : 1 }, style]}
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
                        ) : null}
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
                        className="w-full overflow-hidden"
                        style={{
                            backgroundColor: cardColor,
                            borderTopStartRadius: BORDER_RADIUS,
                            borderTopEndRadius: BORDER_RADIUS,
                        }}>
                        {/* Header */}
                        {modalTitle && (
                            <View className="items-center p-4 pt-5">
                                <TextX variant="subtitle" className="text-center">
                                    {modalTitle}
                                </TextX>
                            </View>
                        )}
                        {/* Options - Updated to match date-picker styling */}
                        <View style={{ height: resolvedOptionsHeight }}>
                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                // contentContainerStyle={{ padding: BUTTON_PADDING_HORIZON }}
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
                                        {section.options.map((option, optionIndex) => {
                                            const globalOptionIndex =
                                                filteredSections
                                                    .slice(0, sectionIndex)
                                                    .reduce((sum, item) => sum + item.options.length, 0) + optionIndex;
                                            const isLastOption = globalOptionIndex === totalOptionsCount - 1;
                                            return renderOption(option, sectionIndex, optionIndex, isLastOption);
                                        })}
                                    </View>
                                ))}

                                {filteredSections.every(section => section.options.length === 0) && (
                                    <View className="items-center px-4 py-6">
                                        <TextX
                                            variant="subtitle"
                                            style={{
                                                color: textMutedColor,
                                            }}>
                                            无可用选项
                                        </TextX>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                        <View
                            style={{
                                borderTopWidth: StyleSheet.hairlineWidth,
                                borderTopColor: borderColor,
                            }}>
                            {multiple ? (
                                <View className="flex-row">
                                    {showCancelButton && (
                                        <>
                                            <TouchableOpacity
                                                className="flex-1 items-center px-5 py-4"
                                                onPress={() => setOpen(false)}
                                                activeOpacity={0.7}>
                                                <TextX
                                                    style={{
                                                        color: text,
                                                        fontWeight: '500',
                                                    }}>
                                                    {cancelText}
                                                </TextX>
                                            </TouchableOpacity>
                                            <View
                                                style={{
                                                    width: StyleSheet.hairlineWidth,
                                                    backgroundColor: borderColor,
                                                }}
                                            />
                                        </>
                                    )}
                                    <TouchableOpacity
                                        className="flex-1 items-center px-5 py-4"
                                        onPress={() => setOpen(false)}
                                        activeOpacity={0.7}>
                                        <TextX
                                            style={{
                                                color: primary,
                                                fontWeight: '600',
                                            }}>
                                            {okText}
                                        </TextX>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                showCancelButton && (
                                    <TouchableOpacity className="items-center px-5 py-4" onPress={() => setOpen(false)} activeOpacity={0.7}>
                                        <TextX
                                            style={{
                                                color: text,
                                                fontWeight: '600',
                                            }}>
                                            {cancelText}
                                        </TextX>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                        <BottomSafeAreaSpacer />
                    </View>
                </View>
            </ModalMask>
        </>
    );
}
