import { Icon } from '@/components/ui/icon';
import { TextX } from '@/components/ui/textx';
import { useColor } from '@/hooks/useColor';
import { BORDER_RADIUS, BUTTON_HEIGHT, BUTTON_HEIGHT_LG, CORNERS, FONT_SIZE } from '@/theme/globals';
import { LucideProps, X } from 'lucide-react-native';
import React, { forwardRef, ReactElement, useRef, useState } from 'react';
import { Pressable, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';

export interface InputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    error?: string;
    icon?: React.ComponentType<LucideProps>;
    rightComponent?: React.ReactNode | (() => React.ReactNode);
    containerStyle?: ViewStyle;
    inputStyle?: TextStyle;
    labelStyle?: TextStyle;
    errorStyle?: TextStyle;
    variant?: 'filled' | 'outline';
    clearable?: boolean;
    onClear?: () => void;
    disabled?: boolean;
    type?: 'input' | 'textarea';
    placeholder?: string;
    rows?: number; // Only used when type="textarea"
}

export const Input = forwardRef<TextInput, InputProps>(
    (
        {
            label,
            error,
            icon,
            rightComponent,
            containerStyle,
            inputStyle,
            labelStyle,
            errorStyle,
            variant = 'filled',
            clearable = false,
            onClear,
            disabled = false,
            type = 'input',
            rows = 4,
            onFocus,
            onBlur,
            onChangeText,
            value,
            defaultValue,
            placeholder,
            ...props
        },
        ref,
    ) => {
        const inputRef = useRef<TextInput>(null);

        const setInputRef = (node: TextInput | null) => {
            inputRef.current = node;
            if (typeof ref === 'function') {
                ref(node);
                return;
            }
            if (ref) {
                ref.current = node;
            }
        };

        const focusInput = () => {
            inputRef.current?.focus();
        };

        const [isFocused, setIsFocused] = useState(false);
        const [internalValue, setInternalValue] = useState(typeof defaultValue === 'string' ? defaultValue : '');

        // Theme colors
        const cardColor = useColor('secondary');
        const textColor = useColor('text');
        const textMutedColor = useColor('textMuted');
        const mutedColor = useColor('muted');
        const borderColor = useColor('border');
        const primary = useColor('primary');
        const danger = useColor('red');

        const isTextarea = type === 'textarea';

        // Calculate height based on type
        const getHeight = () => {
            if (isTextarea) {
                return rows * 20 + 32; // Approximate line height + padding
            }
            return BUTTON_HEIGHT_LG;
        };

        // Variant styles
        const getVariantStyle = (): ViewStyle => {
            const baseStyle: ViewStyle = {
                borderRadius: isTextarea ? BORDER_RADIUS : CORNERS,
                flexDirection: isTextarea ? 'column' : 'row',
                alignItems: isTextarea ? 'stretch' : 'center',
                minHeight: getHeight(),
                paddingVertical: isTextarea ? 12 : 0,
            };

            switch (variant) {
                case 'outline':
                    return {
                        ...baseStyle,
                        borderWidth: 1,
                        borderColor: error ? danger : isFocused ? primary : borderColor,
                        backgroundColor: 'transparent',
                    };
                case 'filled':
                default:
                    return {
                        ...baseStyle,
                        borderWidth: 1,
                        borderColor: error ? danger : cardColor,
                        backgroundColor: disabled ? textMutedColor + '20' : cardColor,
                    };
            }
        };

        const getInputStyle = (): TextStyle => ({
            flex: 1,
            fontSize: FONT_SIZE,
            lineHeight: isTextarea ? 20 : undefined,
            color: disabled ? textMutedColor : textColor,
            paddingVertical: 0, // Remove default padding
            textAlignVertical: isTextarea ? 'top' : 'center',
        });

        const handleFocus = (e: any) => {
            setIsFocused(true);
            onFocus?.(e);
        };

        const handleBlur = (e: any) => {
            setIsFocused(false);
            onBlur?.(e);
        };

        const isControlled = typeof value === 'string';
        const currentValue = isControlled ? value : internalValue;
        const handleChangeText = (text: string) => {
            if (!isControlled) {
                setInternalValue(text);
            }
            onChangeText?.(text);
        };

        // Render right component - supports both direct components and functions
        const renderRightComponent = () => {
            return typeof rightComponent === 'function' ? rightComponent() : rightComponent;
        };

        const customRightComponent = renderRightComponent();
        const shouldAutoShowClearButton = !customRightComponent;
        const hasClearButton = !disabled && currentValue.length > 0 && (clearable || shouldAutoShowClearButton);

        const renderTrailingActions = () => {
            if (!hasClearButton && !customRightComponent) {
                return null;
            }

            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 }}>
                    {hasClearButton ? (
                        <Pressable
                            onPress={() => {
                                handleChangeText('');
                                onClear?.();
                                focusInput();
                            }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="清除输入内容"
                            style={{
                                width: 24,
                                height: 24,
                                borderRadius: 999,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: mutedColor,
                            }}>
                            <X size={12} color={textMutedColor} />
                        </Pressable>
                    ) : null}
                    {customRightComponent}
                </View>
            );
        };

        const renderInputContent = () => (
            <View style={containerStyle}>
                {/* Input Container */}
                <Pressable
                    style={[getVariantStyle(), disabled && { opacity: 0.6 }]}
                    onPress={() => {
                        if (!disabled) {
                            focusInput();
                        }
                    }}
                    disabled={disabled}>
                    {isTextarea ? (
                        // Textarea Layout (Column)
                        <>
                            {/* Header section with icon, label, and right component */}
                            {(icon || label || rightComponent || hasClearButton) && (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginBottom: 8,
                                        gap: 8,
                                    }}>
                                    {/* Left section - Icon + Label */}
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}
                                        pointerEvents="none">
                                        {icon && <Icon name={icon} size={16} color={error ? danger : textMutedColor} />}
                                        {label && (
                                            <TextX
                                                variant="body"
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                                style={[
                                                    {
                                                        color: error ? danger : textMutedColor,
                                                    },
                                                    labelStyle,
                                                ]}
                                                pointerEvents="none">
                                                {label}
                                            </TextX>
                                        )}
                                    </View>

                                    {/* Right Component */}
                                    {renderTrailingActions()}
                                </View>
                            )}

                            {/* TextInput section */}
                            <TextInput
                                ref={setInputRef}
                                multiline
                                numberOfLines={rows}
                                style={[getInputStyle(), inputStyle]}
                                placeholderTextColor={textMutedColor}
                                placeholder={placeholder || 'Type your message...'}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                onChangeText={handleChangeText}
                                value={currentValue}
                                editable={!disabled}
                                selectionColor={primary}
                                {...props}
                            />
                        </>
                    ) : (
                        // Input Layout (Row)
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                            }}>
                            {/* Left section - Icon + Label (fixed width to simulate grid column) */}
                            <View
                                style={{
                                    width: label ? 120 : 'auto',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                                pointerEvents="none">
                                {icon && <Icon name={icon} size={16} color={error ? danger : textMutedColor} />}
                                {label && (
                                    <TextX
                                        variant="body"
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        style={[
                                            {
                                                color: error ? danger : textMutedColor,
                                            },
                                            labelStyle,
                                        ]}
                                        pointerEvents="none">
                                        {label}
                                    </TextX>
                                )}
                            </View>

                            {/* TextInput section - takes remaining space */}
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    ref={setInputRef}
                                    style={[getInputStyle(), inputStyle]}
                                    placeholderTextColor={textMutedColor}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                    onChangeText={handleChangeText}
                                    value={currentValue}
                                    editable={!disabled}
                                    placeholder={placeholder}
                                    selectionColor={primary}
                                    {...props}
                                />
                            </View>

                            {/* Right Component */}
                            {renderTrailingActions()}
                        </View>
                    )}
                </Pressable>

                {/* Error Message */}
                {error && (
                    <TextX
                        style={[
                            {
                                marginLeft: 14,
                                marginTop: 4,
                                fontSize: 14,
                                color: danger,
                            },
                            errorStyle,
                        ]}>
                        {error}
                    </TextX>
                )}
            </View>
        );

        return renderInputContent();
    },
);

export interface GroupedInputProps {
    children: React.ReactNode;
    containerStyle?: ViewStyle;
    title?: string;
    titleStyle?: TextStyle;
}

export const GroupedInput = ({ children, containerStyle, title, titleStyle }: GroupedInputProps) => {
    const border = useColor('border');
    const background = useColor('card');
    const danger = useColor('red');

    const childrenArray = React.Children.toArray(children);

    const errors = childrenArray
        .filter((child): child is ReactElement<any> => React.isValidElement(child) && !!(child.props as any).error)
        .map(child => child.props.error);

    const renderGroupedContent = () => (
        <View style={containerStyle}>
            {!!title && (
                <TextX variant="title" style={[{ marginBottom: 8, marginLeft: 8 }, titleStyle]}>
                    {title}
                </TextX>
            )}

            <View
                style={{
                    backgroundColor: background,
                    borderColor: border,
                    borderWidth: 1,
                    borderRadius: BORDER_RADIUS,
                    overflow: 'hidden',
                }}>
                {childrenArray.map((child, index) => (
                    <View
                        key={index}
                        style={{
                            minHeight: BUTTON_HEIGHT,
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            justifyContent: 'center',
                            borderBottomWidth: index !== childrenArray.length - 1 ? 1 : 0,
                            borderColor: border,
                        }}>
                        {child}
                    </View>
                ))}
            </View>

            {errors.length > 0 && (
                <View style={{ marginTop: 6 }}>
                    {errors.map((error, i) => (
                        <TextX
                            key={i}
                            style={{
                                fontSize: 14,
                                color: danger,
                                marginTop: i === 0 ? 0 : 1,
                                marginLeft: 8,
                            }}>
                            {error}
                        </TextX>
                    ))}
                </View>
            )}
        </View>
    );

    return renderGroupedContent();
};

export interface GroupedInputItemProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    error?: string;
    icon?: React.ComponentType<LucideProps>;
    rightComponent?: React.ReactNode | (() => React.ReactNode);
    inputStyle?: TextStyle;
    labelStyle?: TextStyle;
    errorStyle?: TextStyle;
    disabled?: boolean;
    type?: 'input' | 'textarea';
    rows?: number; // Only used when type="textarea"
}

export const GroupedInputItem = forwardRef<TextInput, GroupedInputItemProps>(
    (
        {
            label,
            error,
            icon,
            rightComponent,
            inputStyle,
            labelStyle,
            errorStyle,
            disabled,
            type = 'input',
            rows = 3,
            onFocus,
            onBlur,
            placeholder,
            ...props
        },
        ref,
    ) => {
        const text = useColor('text');
        const textMutedColor = useColor('textMuted');
        const primary = useColor('primary');
        const danger = useColor('red');

        const isTextarea = type === 'textarea';

        const handleFocus = (e: any) => {
            onFocus?.(e);
        };

        const handleBlur = (e: any) => {
            onBlur?.(e);
        };

        const renderRightComponent = () => {
            if (!rightComponent) return null;
            return typeof rightComponent === 'function' ? rightComponent() : rightComponent;
        };

        const renderItemContent = () => (
            <Pressable
                onPress={() => ref && 'current' in ref && ref.current?.focus()}
                disabled={disabled}
                style={{ opacity: disabled ? 0.6 : 1 }}>
                <View
                    style={{
                        flexDirection: isTextarea ? 'column' : 'row',
                        alignItems: isTextarea ? 'stretch' : 'center',
                        backgroundColor: 'transparent',
                    }}>
                    {isTextarea ? (
                        // Textarea Layout (Column)
                        <>
                            {/* Header section with icon, label, and right component */}
                            {(icon || label || rightComponent) && (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginBottom: 8,
                                        gap: 8,
                                    }}>
                                    {/* Icon & Label */}
                                    <View
                                        style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}
                                        pointerEvents="none">
                                        {icon && <Icon name={icon} size={16} color={error ? danger : textMutedColor} />}
                                        {label && (
                                            <TextX
                                                variant="body"
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                                style={[
                                                    {
                                                        color: error ? danger : textMutedColor,
                                                    },
                                                    labelStyle,
                                                ]}
                                                pointerEvents="none">
                                                {label}
                                            </TextX>
                                        )}
                                    </View>

                                    {/* Right Component */}
                                    {renderRightComponent()}
                                </View>
                            )}

                            {/* Textarea Input */}
                            <TextInput
                                ref={ref}
                                multiline
                                numberOfLines={rows}
                                style={[
                                    {
                                        fontSize: FONT_SIZE,
                                        lineHeight: 20,
                                        color: disabled ? textMutedColor : text,
                                        textAlignVertical: 'top',
                                        paddingVertical: 0,
                                        minHeight: rows * 20,
                                    },
                                    inputStyle,
                                ]}
                                placeholderTextColor={textMutedColor}
                                placeholder={placeholder || 'Type your message...'}
                                editable={!disabled}
                                selectionColor={primary}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                {...props}
                            />
                        </>
                    ) : (
                        // Input Layout (Row)
                        <View
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                            }}>
                            {/* Icon & Label */}
                            <View
                                style={{
                                    width: label ? 120 : 'auto',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                }}
                                pointerEvents="none">
                                {icon && <Icon name={icon} size={16} color={error ? danger : textMutedColor} />}
                                {label && (
                                    <TextX
                                        variant="body"
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        style={[
                                            {
                                                color: error ? danger : textMutedColor,
                                            },
                                            labelStyle,
                                        ]}
                                        pointerEvents="none">
                                        {label}
                                    </TextX>
                                )}
                            </View>

                            {/* Input */}
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    ref={ref}
                                    style={[
                                        {
                                            flex: 1,
                                            fontSize: FONT_SIZE,
                                            color: disabled ? textMutedColor : text,
                                            paddingVertical: 0,
                                        },
                                        inputStyle,
                                    ]}
                                    placeholder={placeholder}
                                    placeholderTextColor={textMutedColor}
                                    editable={!disabled}
                                    selectionColor={primary}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                    {...props}
                                />
                            </View>

                            {/* Right Component */}
                            {renderRightComponent()}
                        </View>
                    )}
                </View>
            </Pressable>
        );

        return renderItemContent();
    },
);
