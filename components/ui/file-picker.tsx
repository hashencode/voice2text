import { Button, ButtonVariant } from '@/components/ui/button';
import { TextX } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import * as DocumentPicker from 'expo-document-picker';
import { File, Image, X } from 'lucide-react-native';
import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, ViewStyle } from 'react-native';

export type FileType = 'image' | 'document' | 'all';

export interface SelectedFile {
    uri: string;
    name: string;
    type?: string;
    size?: number;
    mimeType?: string;
}

export interface FilePickerProps {
    // Core functionality
    onFilesSelected: (files: SelectedFile[]) => void;
    onError?: (error: string) => void;

    // Configuration
    fileType?: FileType;
    multiple?: boolean;
    maxFiles?: number;
    maxSizeBytes?: number;
    allowedExtensions?: string[];

    // UI customization
    placeholder?: string;
    disabled?: boolean;
    style?: ViewStyle;
    showPreview?: boolean;
    showFileInfo?: boolean;

    // Accessibility
    accessibilityLabel?: string;
    accessibilityHint?: string;

    variant?: ButtonVariant;
}

interface FilePickerMethods {
    clearFiles: () => void;
    openPicker: () => void;
}

export const FilePicker = forwardRef<FilePickerMethods, FilePickerProps>(
    (
        {
            onFilesSelected,
            onError,
            fileType = 'all',
            multiple = false,
            maxFiles = 10,
            maxSizeBytes = 50 * 1024 * 1024, // 50MB default
            allowedExtensions,
            placeholder = 'Select files',
            disabled = false,
            style = {},
            showFileInfo = true,
            accessibilityLabel,
            accessibilityHint,
            variant = 'outline',
        },
        ref,
    ) => {
        const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

        // Theme colors
        const backgroundColor = useColor('card');
        const borderColor = useColor('border');
        const textColor = useColor('text');
        const mutedTextColor = useColor('textMuted');
        const primaryColor = useColor('primary');

        // Expose methods via ref
        React.useImperativeHandle(ref, () => ({
            clearFiles: () => {
                setSelectedFiles([]);
                onFilesSelected([]);
            },
            openPicker: () => {
                handleDocumentPick();
            },
        }));

        const validateFile = useCallback(
            (file: SelectedFile): string | null => {
                // Size validation
                if (file.size && file.size > maxSizeBytes) {
                    return `File size exceeds ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB limit`;
                }

                // Extension validation
                if (allowedExtensions && allowedExtensions.length > 0) {
                    const extension = file.name.split('.').pop()?.toLowerCase();
                    if (!extension || !allowedExtensions.includes(extension)) {
                        return `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`;
                    }
                }

                return null;
            },
            [maxSizeBytes, allowedExtensions],
        );

        const addFiles = useCallback(
            (newFiles: SelectedFile[]) => {
                const validFiles: SelectedFile[] = [];
                const errors: string[] = [];

                for (const file of newFiles) {
                    const error = validateFile(file);
                    if (error) {
                        errors.push(`${file.name}: ${error}`);
                    } else {
                        validFiles.push(file);
                    }
                }

                if (errors.length > 0) {
                    onError?.(errors.join('\n'));
                }

                if (validFiles.length > 0) {
                    const updatedFiles = multiple ? [...selectedFiles, ...validFiles].slice(0, maxFiles) : validFiles.slice(0, 1);

                    setSelectedFiles(updatedFiles);
                    onFilesSelected(updatedFiles);

                    if (multiple && selectedFiles.length + validFiles.length > maxFiles) {
                        onError?.(`Only first ${maxFiles} files were selected`);
                    }
                }
            },
            [selectedFiles, multiple, maxFiles, validateFile, onFilesSelected, onError],
        );

        const removeFile = useCallback(
            (index: number) => {
                const updatedFiles = selectedFiles.filter((_, i) => i !== index);
                setSelectedFiles(updatedFiles);
                onFilesSelected(updatedFiles);
            },
            [selectedFiles, onFilesSelected],
        );

        const handleDocumentPick = useCallback(async () => {
            try {
                const result = await DocumentPicker.getDocumentAsync({
                    type: fileType === 'image' ? 'image/*' : '*/*',
                    multiple,
                    copyToCacheDirectory: true,
                });

                if (!result.canceled) {
                    const files: SelectedFile[] = result.assets.map(asset => ({
                        uri: asset.uri,
                        name: asset.name,
                        size: asset.size,
                        mimeType: asset.mimeType || undefined,
                    }));
                    addFiles(files);
                }
            } catch (error) {
                onError?.(`Failed to pick document: ${error}`);
            }
        }, [fileType, multiple, addFiles, onError]);

        const handlePickerPress = useCallback(() => {
            if (disabled) return;

            handleDocumentPick();
        }, [disabled, fileType, handleDocumentPick]);

        const formatFileSize = (bytes: number): string => {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };

        const getFileIcon = (fileName: string) => {
            const extension = fileName.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
                return <Image size={20} color={primaryColor} />;
            }
            return <File size={20} color={primaryColor} />;
        };

        return (
            <View className="w-full">
                {/* File Picker Button */}
                <Button
                    variant={variant}
                    onPress={handlePickerPress}
                    disabled={disabled}
                    style={[{ justifyContent: 'flex-start', paddingHorizontal: 16, minHeight: 48 }, style]}
                    accessibilityLabel={accessibilityLabel || `Select ${fileType} files`}
                    accessibilityHint={accessibilityHint || 'Opens file picker'}>
                    <View className="flex-row items-center gap-3">
                        {fileType === 'image' ? (
                            <Image size={20} color={disabled ? mutedTextColor : primaryColor} />
                        ) : (
                            <File size={20} color={disabled ? mutedTextColor : primaryColor} />
                        )}
                        <TextX className="text-base font-normal" style={{ color: disabled ? mutedTextColor : textColor }}>
                            {selectedFiles.length > 0
                                ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                                : placeholder}
                        </TextX>
                    </View>
                </Button>

                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                    <ScrollView className="mt-3 max-h-[300px]" showsVerticalScrollIndicator={false}>
                        {selectedFiles.map((file, index) => (
                            <View
                                key={`${file.uri}-${index}`}
                                className="mb-2 flex-row items-center justify-between rounded-xl border p-3"
                                style={{ backgroundColor, borderColor }}>
                                <View className="flex-1 flex-row items-center gap-3">
                                    {getFileIcon(file.name)}
                                    <View className="flex-1">
                                        <TextX className="text-base font-medium" style={{ color: textColor }} numberOfLines={1}>
                                            {file.name}
                                        </TextX>
                                        {showFileInfo && file.size && (
                                            <TextX className="mt-0.5 text-sm" style={{ color: mutedTextColor }}>
                                                {formatFileSize(file.size)}
                                            </TextX>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => removeFile(index)}
                                    className="p-1"
                                    accessibilityLabel={`Remove ${file.name}`}>
                                    <X size={16} color={mutedTextColor} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        );
    },
);

FilePicker.displayName = 'FilePicker';

// Export utility functions for external use
export const createFileFromUri = async (uri: string, name?: string): Promise<SelectedFile> => {
    return {
        uri,
        name: name || uri.split('/').pop() || 'file',
    };
};

export const validateFiles = (
    files: SelectedFile[],
    options: {
        maxSize?: number;
        allowedExtensions?: string[];
        maxFiles?: number;
    },
): { valid: SelectedFile[]; errors: string[] } => {
    const valid: SelectedFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
        if (options.maxSize && file.size && file.size > options.maxSize) {
            errors.push(`${file.name}: File too large`);
            continue;
        }

        if (options.allowedExtensions) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (!ext || !options.allowedExtensions.includes(ext)) {
                errors.push(`${file.name}: File type not allowed`);
                continue;
            }
        }

        valid.push(file);
    }

    if (options.maxFiles && valid.length > options.maxFiles) {
        valid.splice(options.maxFiles);
        errors.push(`Only first ${options.maxFiles} files selected`);
    }

    return { valid, errors };
};

export interface UseFilePickerOptions {
    maxFiles?: number;
    maxSizeBytes?: number;
    allowedExtensions?: string[];
    onError?: (error: string) => void;
}

export interface UseFilePickerReturn {
    files: SelectedFile[];
    addFiles: (newFiles: SelectedFile[]) => void;
    removeFile: (index: number) => void;
    clearFiles: () => void;
    totalSize: number;
    isValid: boolean;
    errors: string[];
}

export function useFilePicker(options: UseFilePickerOptions = {}): UseFilePickerReturn {
    const {
        maxFiles = 10,
        maxSizeBytes = 50 * 1024 * 1024, // 50MB default
        allowedExtensions,
        onError,
    } = options;

    const [files, setFiles] = useState<SelectedFile[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const validateFile = useCallback(
        (file: SelectedFile): string | null => {
            // Check file size
            if (file.size && file.size > maxSizeBytes) {
                return `File size exceeds ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB limit`;
            }

            // Check file extension
            if (allowedExtensions && allowedExtensions.length > 0) {
                const extension = file.name.split('.').pop()?.toLowerCase();
                if (!extension || !allowedExtensions.includes(extension)) {
                    return `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`;
                }
            }

            return null;
        },
        [maxSizeBytes, allowedExtensions],
    );

    const addFiles = useCallback(
        (newFiles: SelectedFile[]) => {
            const validFiles: SelectedFile[] = [];
            const validationErrors: string[] = [];

            // Validate each file
            for (const file of newFiles) {
                const error = validateFile(file);
                if (error) {
                    validationErrors.push(`${file.name}: ${error}`);
                } else {
                    validFiles.push(file);
                }
            }

            // Handle validation errors
            if (validationErrors.length > 0) {
                setErrors(validationErrors);
                onError?.(validationErrors.join('\n'));
            } else {
                setErrors([]);
            }

            // Add valid files
            if (validFiles.length > 0) {
                setFiles(prev => {
                    const combined = [...prev, ...validFiles];

                    // Check if exceeds max files limit
                    if (combined.length > maxFiles) {
                        const truncated = combined.slice(0, maxFiles);
                        const truncationError = `Only first ${maxFiles} files were selected`;
                        setErrors(prev => [...prev, truncationError]);
                        onError?.(truncationError);
                        return truncated;
                    }

                    return combined;
                });
            }
        },
        [validateFile, maxFiles, onError],
    );

    const removeFile = useCallback((index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        // Clear errors when files are removed
        setErrors([]);
    }, []);

    const clearFiles = useCallback(() => {
        setFiles([]);
        setErrors([]);
    }, []);

    // Calculate total size of all files
    const totalSize = useMemo(() => {
        return files.reduce((sum, file) => sum + (file.size || 0), 0);
    }, [files]);

    // Check if current state is valid
    const isValid = useMemo(() => {
        return errors.length === 0 && files.length > 0 && files.length <= maxFiles;
    }, [errors.length, files.length, maxFiles]);

    return {
        files,
        addFiles,
        removeFile,
        clearFiles,
        totalSize,
        isValid,
        errors,
    };
}
