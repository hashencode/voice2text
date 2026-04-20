import { CalendarDays } from 'lucide-react-native';
import React from 'react';
import { TextInput, View } from 'react-native';
import { TextX } from '~/components/ui/textx';
import { formatHeaderDate } from '~/features/session-editor/services/time-format';

type SessionHeaderProps = {
    displayName: string;
    onChangeDisplayName: (value: string) => void;
    textColor: string;
    mutedTextColor: string;
    headerAtMs: number;
    editable?: boolean;
};

export default function SessionHeader({
    displayName,
    onChangeDisplayName,
    textColor,
    mutedTextColor,
    headerAtMs,
    editable = true,
}: SessionHeaderProps) {
    return (
        <>
            <TextInput
                value={displayName}
                onChangeText={onChangeDisplayName}
                editable={editable}
                placeholderTextColor={mutedTextColor}
                className="p-0 text-2xl font-semibold"
                style={{ color: textColor }}
            />

            <View className="mt-3 flex-row items-center">
                <View className="flex-row items-center gap-1.5">
                    <CalendarDays size={14} color={mutedTextColor} />
                    <TextX style={{ color: mutedTextColor }}>{formatHeaderDate(headerAtMs)}</TextX>
                </View>
            </View>
        </>
    );
}
