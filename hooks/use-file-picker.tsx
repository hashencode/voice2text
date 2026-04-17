import { useUpdateEffect } from 'ahooks';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useMemo, useState } from 'react';

export type FileType = 'image' | 'document' | 'all';

export interface SelectedFile {
    uri: string;
    name: string;
    type?: string;
    size?: number;
    mimeType?: string;
}

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
    onFilesSelected?: (files: SelectedFile[]) => void;
    fileType?: FileType;
    multiple?: boolean;
}

export interface UseFilePickerReturn {
    files: SelectedFile[];
    addFiles: (newFiles: SelectedFile[]) => void;
    removeFile: (index: number) => void;
    clearFiles: () => void;
    totalSize: number;
    isValid: boolean;
    errors: string[];
    pickDocument: (options?: { fileType?: FileType; multiple?: boolean }) => Promise<SelectedFile[]>;
}

export function useFilePicker(options: UseFilePickerOptions = {}): UseFilePickerReturn {
    const {
        maxFiles = 10,
        maxSizeBytes,
        allowedExtensions,
        onError,
        onFilesSelected,
        fileType = 'all',
        multiple = false,
    } = options;

    const [files, setFiles] = useState<SelectedFile[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const validateFile = useCallback(
        (file: SelectedFile): string | null => {
            // Check file size
            if (typeof maxSizeBytes === 'number' && file.size && file.size > maxSizeBytes) {
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
                    const combined = multiple ? [...prev, ...validFiles] : validFiles.slice(0, 1);

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
        [validateFile, maxFiles, multiple, onError],
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

    const pickDocument = useCallback(
        async (pickOptions: { fileType?: FileType; multiple?: boolean } = {}) => {
            try {
                const effectiveFileType = pickOptions.fileType ?? fileType;
                const effectiveMultiple = pickOptions.multiple ?? multiple;
                const result = await DocumentPicker.getDocumentAsync({
                    type: effectiveFileType === 'image' ? 'image/*' : '*/*',
                    multiple: effectiveMultiple,
                    copyToCacheDirectory: true,
                });

                if (result.canceled) {
                    return [];
                }

                const selectedFiles: SelectedFile[] = result.assets.map(asset => ({
                    uri: asset.uri,
                    name: asset.name,
                    size: asset.size,
                    mimeType: asset.mimeType || undefined,
                }));

                addFiles(selectedFiles);
                return selectedFiles;
            } catch (error) {
                const message = `Failed to pick document: ${String(error)}`;
                setErrors(prev => [...prev, message]);
                onError?.(message);
                return [];
            }
        },
        [addFiles, fileType, multiple, onError],
    );

    // Calculate total size of all files
    const totalSize = useMemo(() => {
        return files.reduce((sum, file) => sum + (file.size || 0), 0);
    }, [files]);

    // Check if current state is valid
    const isValid = useMemo(() => {
        return errors.length === 0 && files.length > 0 && files.length <= maxFiles;
    }, [errors.length, files.length, maxFiles]);

    useUpdateEffect(() => {
        onFilesSelected?.(files);
    }, [files, onFilesSelected]);

    return {
        files,
        addFiles,
        removeFile,
        clearFiles,
        totalSize,
        isValid,
        errors,
        pickDocument,
    };
}
