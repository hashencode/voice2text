import { Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Clock3, FolderOpen, Tag, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import type { EnrichedTextInputInstance } from 'react-native-enriched';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { ButtonX } from '~/components/ui/buttonx';
import { Picker } from '~/components/ui/picker';
import { TextX } from '~/components/ui/textx';
import RichNoteEditor from '~/features/editor/rich-note-editor';
import { useRecordReviewSession } from '~/features/session-editor/hooks/use-record-review-session';
import SessionHeader from '~/features/session-editor/components/session-header';
import { formatHeaderDate, formatTime } from '~/features/session-editor/services/time-format';
import { useColor } from '~/hooks/use-color';

function InfoRow({
    icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ size?: number; color?: string }>;
    label: string;
    value: string;
}) {
    const mutedTextColor = useColor('textMuted');
    const textColor = useColor('text');
    const borderColor = useColor('border');
    const cardColor = useColor('card');
    const Icon = icon;

    return (
        <View className="flex-row items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor, backgroundColor: cardColor }}>
            <View className="flex-row items-center gap-2">
                <Icon size={16} color={mutedTextColor} />
                <TextX style={{ color: mutedTextColor }}>{label}</TextX>
            </View>
            <TextX className="font-medium" style={{ color: textColor }}>
                {value}
            </TextX>
        </View>
    );
}

export default function RecordReviewPage() {
    const noteInputRef = React.useRef<EnrichedTextInputInstance | null>(null);
    const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
    const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
    const {
        draft,
        folders,
        isLoading,
        isSaving,
        setDisplayName,
        setNoteText,
        setGroupName,
        updateMarkerNote,
        handleContinueRecording,
        handleSave,
        handleDiscard,
        confirmDialogState,
        closeConfirmDialog,
    } = useRecordReviewSession(sessionId);

    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const borderColor = useColor('border');
    const cardColor = useColor('card');
    const backgroundColor = useColor('background');
    const placeholderColor = useColor('textMuted');
    const primaryColor = useColor('primary');

    const groupOptions = React.useMemo(
        () => [{ label: '未分组', value: '' }, ...folders.map(folder => ({ label: folder.name, value: folder.name }))],
        [folders],
    );

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-1" style={{ backgroundColor }}>
                <View className="flex-row items-center justify-between px-4 pb-3 pt-4">
                    <Pressable onPress={() => void handleContinueRecording()} className="flex-row items-center gap-2">
                        <ArrowLeft size={24} color={textColor} />
                        <TextX className="text-lg font-semibold" style={{ color: textColor }}>
                            确认保存
                        </TextX>
                    </Pressable>

                    <Pressable onPress={handleDiscard} className="rounded-full p-2" disabled={isSaving}>
                        <Trash2 size={20} color={mutedTextColor} />
                    </Pressable>
                </View>

                {isLoading || !draft ? (
                    <View className="flex-1 items-center justify-center px-6">
                        <TextX style={{ color: mutedTextColor }}>正在载入录音草稿...</TextX>
                    </View>
                ) : (
                    <>
                        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 24 }}>
                            <View className="rounded-[28px] px-4 py-4" style={{ backgroundColor: cardColor }}>
                                <SessionHeader
                                    displayName={draft.displayName}
                                    onChangeDisplayName={setDisplayName}
                                    textColor={textColor}
                                    mutedTextColor={mutedTextColor}
                                    headerAtMs={draft.recordedAtMs}
                                />

                                <View className="mt-4 gap-3">
                                    <InfoRow icon={Clock3} label="录音时长" value={formatTime(draft.durationMs / 1000)} />
                                    <InfoRow icon={Tag} label="开始时间" value={formatHeaderDate(draft.recordedAtMs)} />
                                    <View
                                        className="rounded-2xl border px-4 py-3"
                                        style={{ borderColor, backgroundColor: cardColor }}>
                                        <View className="mb-2 flex-row items-center gap-2">
                                            <FolderOpen size={16} color={mutedTextColor} />
                                            <TextX style={{ color: mutedTextColor }}>所在分组</TextX>
                                        </View>
                                        <Picker
                                            value={draft.groupName ?? ''}
                                            options={groupOptions}
                                            modalTitle="选择录音分组"
                                            onValueChange={setGroupName}
                                        />
                                    </View>
                                </View>
                            </View>

                            <View className="mt-4 rounded-[28px] px-4 py-4" style={{ backgroundColor: cardColor }}>
                                <TextX className="mb-3 text-lg font-semibold" style={{ color: textColor }}>
                                    笔记
                                </TextX>
                                <View className="min-h-[220px] overflow-hidden rounded-2xl border px-2 py-2" style={{ borderColor }}>
                                    <RichNoteEditor
                                        inputRef={noteInputRef}
                                        initialText={draft.noteText}
                                        onTextChange={setNoteText}
                                        placeholder="补充这条录音的背景、结论或待办"
                                    />
                                </View>
                            </View>

                            <View className="mt-4 rounded-[28px] px-4 py-4" style={{ backgroundColor: cardColor }}>
                                <TextX className="text-lg font-semibold" style={{ color: textColor }}>
                                    标记
                                </TextX>
                                <TextX className="mt-1" style={{ color: mutedTextColor }}>
                                    {draft.markers.length === 0 ? '本次录音还没有标记。' : `共 ${draft.markers.length} 个标记`}
                                </TextX>

                                <View className="mt-4 gap-3">
                                    {draft.markers.map((marker, index) => (
                                        <View
                                            key={`${marker.timeMs}-${index}`}
                                            className="rounded-2xl border px-4 py-3"
                                            style={{ borderColor }}>
                                            <View className="mb-2 flex-row items-center justify-between">
                                                <TextX className="font-medium" style={{ color: primaryColor }}>
                                                    标记 {index + 1}
                                                </TextX>
                                                <TextX style={{ color: mutedTextColor }}>{formatTime(marker.timeMs / 1000)}</TextX>
                                            </View>
                                            <TextInput
                                                value={marker.noteText ?? ''}
                                                onChangeText={value => updateMarkerNote(index, value)}
                                                placeholder="给这个标记补一句说明"
                                                placeholderTextColor={placeholderColor}
                                                multiline
                                                className="min-h-[72px] text-base"
                                                style={{ color: textColor, textAlignVertical: 'top' }}
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>

                        <View className="px-4 pb-2 pt-3">
                            <View className="flex-row gap-3">
                                <View className="flex-1">
                                    <ButtonX variant="outline" size="lg" onPress={() => void handleContinueRecording()} disabled={isSaving}>
                                        继续录音
                                    </ButtonX>
                                </View>
                                <View className="flex-1">
                                    <ButtonX variant="primary" size="lg" onPress={() => void handleSave()} loading={isSaving}>
                                        保存
                                    </ButtonX>
                                </View>
                            </View>
                            <BottomSafeAreaSpacer />
                        </View>
                    </>
                )}
            </View>

            <AlertDialog
                isVisible={confirmDialogState.isVisible}
                title={confirmDialogState.title}
                description={confirmDialogState.description}
                confirmText={confirmDialogState.confirmText}
                cancelText={confirmDialogState.cancelText}
                confirmButtonProps={confirmDialogState.confirmButtonProps}
                onConfirm={confirmDialogState.onConfirm}
                onClose={closeConfirmDialog}
                onCancel={confirmDialogState.onCancel}
            />
        </DefaultLayout>
    );
}
