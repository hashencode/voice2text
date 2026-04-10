import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { ChatBubbleTranslate, DesignPencil, Post } from 'iconoir-react-native';
import { ArrowLeft, CalendarDays, Mic, Square } from 'lucide-react-native';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { EnrichedTextInputInstance, OnChangeStateEvent } from 'react-native-enriched';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import EditorKeyboardToolbar from '~/features/editor/editor-keyboard-toolbar';
import RichNoteEditor from '~/features/editor/rich-note-editor';
import LiveTranscriptPanel from '~/features/session-editor/components/live-transcript-panel';
import { useRecordSession } from '~/features/session-editor/hooks/use-record-session';
import { formatHeaderDate } from '~/features/session-editor/services/time-format';
import type { EditorTabValue } from '~/features/session-editor/types';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS, BORDER_RADIUS_SM, BUTTON_ICON_LG } from '~/theme/globals';

export default function RecordPage() {
    const [isNoteFocused, setIsNoteFocused] = React.useState(false);
    const [noteStyleState, setNoteStyleState] = React.useState<OnChangeStateEvent | null>(null);
    const noteInputRef = React.useRef<EnrichedTextInputInstance | null>(null);
    const {
        displayName,
        setDisplayName,
        editorTab,
        setEditorTab,
        headerAtMs,
        confirmDialogState,
        closeConfirmDialog,
        cancelConfirmDialog,
        phase,
        actionLoading,
        elapsedText,
        isPaused,
        isRecordingOrPaused,
        isStopping,
        canStop,
        isIdleLike,
        isMicVisualState,
        handleLeftAction,
        handleConfirmStop,
        handleBackPress,
        recordingEndedAtMs,
    } = useRecordSession();
    const { toast } = useToast();

    const primaryColor = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');
    const destructiveColor = useColor('destructive');
    const destructiveForegroundColor = useColor('destructiveForeground');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const cardColor = useColor('card');
    const mutedColor = useColor('muted');
    const showKeyboardToolbar = editorTab === 'remark' && isNoteFocused;

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex flex-1">
                <View className="flex-1 px-4 pt-4">
                    <TextInput
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholderTextColor={mutedTextColor}
                        className="p-0 text-3xl font-semibold"
                        style={{ color: textColor }}
                    />

                    <View className="mt-3 flex-row items-center">
                        <View className="flex-row items-center gap-1.5">
                            <CalendarDays size={14} color={mutedTextColor} />
                            <TextX style={{ color: mutedTextColor }}>{formatHeaderDate(headerAtMs)}</TextX>
                        </View>
                    </View>

                    <View className="mt-3 flex-1">
                        <Tabs
                            value={editorTab}
                            onValueChange={value => setEditorTab(value as EditorTabValue)}
                            contentSwitchDelayMs={180}
                            style={{ flex: 1 }}>
                            <TabsList radius={BORDER_RADIUS_SM} style={{ backgroundColor: mutedColor }}>
                                <TabsTrigger value="remark" icon={DesignPencil} iconProps={{ width: BUTTON_ICON_LG, height: BUTTON_ICON_LG }}>
                                    灵感速记
                                </TabsTrigger>
                                <TabsTrigger
                                    value="transcript"
                                    icon={ChatBubbleTranslate}
                                    iconProps={{ width: BUTTON_ICON_LG, height: BUTTON_ICON_LG }}>
                                    实时转写
                                </TabsTrigger>
                                <TabsTrigger value="summary" icon={Post} iconProps={{ width: BUTTON_ICON_LG, height: BUTTON_ICON_LG }}>
                                    智能总结
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="remark" style={{ flex: 1 }}>
                                <RichNoteEditor
                                    placeholder="编辑录音备注"
                                    inputRef={noteInputRef}
                                    onFocusChange={setIsNoteFocused}
                                    onStyleStateChange={setNoteStyleState}
                                />
                            </TabsContent>

                            <TabsContent value="transcript">
                                <LiveTranscriptPanel
                                    phase={phase}
                                    editorTab={editorTab}
                                    recordingEndedAtMs={recordingEndedAtMs}
                                    textColor={textColor}
                                    mutedTextColor={mutedTextColor}
                                />
                            </TabsContent>

                            <TabsContent value="summary">
                                <TextX style={{ color: mutedTextColor }}>...</TextX>
                            </TabsContent>
                        </Tabs>
                    </View>
                </View>

                <View
                    className="flex-shrink-0"
                    style={{
                        backgroundColor: cardColor,
                        borderStartStartRadius: BORDER_RADIUS,
                        borderEndStartRadius: BORDER_RADIUS,
                    }}>
                    <View className="flex-row items-center gap-3 p-3 pb-4">
                        {isIdleLike ? (
                            <Pressable onPress={handleBackPress} disabled={isStopping || actionLoading}>
                                <View
                                    className="h-12 w-12 items-center justify-center rounded-full"
                                    style={{ backgroundColor: mutedColor, opacity: isStopping ? 0.5 : 1 }}>
                                    <ArrowLeft size={20} color={textColor} />
                                </View>
                            </Pressable>
                        ) : canStop ? (
                            <Pressable onPress={handleConfirmStop} disabled={isStopping}>
                                <View
                                    className="h-12 w-12 items-center justify-center rounded-full"
                                    style={{ backgroundColor: destructiveColor, opacity: isStopping ? 0.5 : 1 }}>
                                    <Square size={20} color={destructiveForegroundColor} />
                                </View>
                            </Pressable>
                        ) : (
                            <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: mutedColor, opacity: 0.5 }}>
                                <Square size={20} color={destructiveColor} />
                            </View>
                        )}

                        <View className="flex-1 items-center justify-center">
                            {isRecordingOrPaused ? (
                                <TextX style={{ fontVariant: ['tabular-nums'], fontSize: 24 }}>{elapsedText}</TextX>
                            ) : (
                                <TextX style={{ color: mutedTextColor }}>点击右侧开始录制</TextX>
                            )}
                        </View>

                        <BouncyPressable onPress={handleLeftAction} disabled={actionLoading || isStopping} scaleIn={1.08}>
                            <View
                                className="h-12 w-12 items-center justify-center rounded-full"
                                style={{
                                    backgroundColor: isMicVisualState ? primaryColor : mutedColor,
                                    opacity: isStopping ? 0.5 : 1,
                                }}>
                                {isIdleLike ? (
                                    <Mic size={22} color={primaryForegroundColor} />
                                ) : isPaused ? (
                                    <Ionicons name="play" size={22} color={textColor} style={{ transform: [{ translateX: 1.5 }] }} />
                                ) : (
                                    <Ionicons name="pause" size={22} color={textColor} />
                                )}
                            </View>
                        </BouncyPressable>
                    </View>
                    <BottomSafeAreaSpacer />
                </View>
            </View>
            <EditorKeyboardToolbar
                visible={showKeyboardToolbar}
                noteInputRef={noteInputRef}
                noteStyleState={noteStyleState}
                primaryColor={primaryColor}
                textColor={textColor}
                mutedColor={mutedColor}
                mutedTextColor={mutedTextColor}
                onBlocked={() => {
                    toast({
                        title: '当前标题样式下不可用',
                        description: '请先取消标题样式后再使用该格式',
                        variant: 'error',
                        duration: 2200,
                    });
                }}
            />
            <AlertDialog
                isVisible={confirmDialogState.isVisible}
                title={confirmDialogState.title}
                description={confirmDialogState.description}
                confirmText={confirmDialogState.confirmText}
                confirmButtonProps={confirmDialogState.confirmButtonProps}
                cancelText="取消"
                onConfirm={confirmDialogState.onConfirm}
                onClose={closeConfirmDialog}
                onCancel={cancelConfirmDialog}
            />
        </DefaultLayout>
    );
}
