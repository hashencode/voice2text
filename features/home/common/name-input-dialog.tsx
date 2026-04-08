import React from 'react';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { Input } from '~/components/ui/input';

type NameInputDialogProps = {
    isVisible: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    value: string;
    error?: string;
    placeholder: string;
    isSubmitting: boolean;
    onChangeText: (text: string) => void;
    onConfirm: () => Promise<boolean>;
};

export default function NameInputDialog({
    isVisible,
    onClose,
    title,
    description,
    value,
    error,
    placeholder,
    isSubmitting,
    onChangeText,
    onConfirm,
}: NameInputDialogProps) {
    return (
        <AlertDialog
            isVisible={isVisible}
            onClose={onClose}
            title={title}
            description={description}
            confirmText="确定"
            cancelText="取消"
            confirmButtonProps={{ disabled: isSubmitting }}
            cancelButtonProps={{ disabled: isSubmitting }}
            onConfirm={onConfirm}>
            <Input
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                error={error || undefined}
                returnKeyType="done"
                variant="outline"
                clearable
                onSubmitEditing={() => {
                    onConfirm().catch(() => {});
                }}
            />
        </AlertDialog>
    );
}
