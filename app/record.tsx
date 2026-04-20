import { Stack } from 'expo-router';
import { ChatBubbleTranslate, DesignPencil, Post } from 'iconoir-react-native';
import { ArrowLeft, Mic, PauseIcon, PlayIcon, Square } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import type { EnrichedTextInputInstance } from 'react-native-enriched';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { IconButton } from '~/components/ui/icon-button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import RichNoteEditor from '~/features/editor/rich-note-editor';
import LiveTranscriptPanel from '~/features/session-editor/components/live-transcript-panel';
import SessionHeader from '~/features/session-editor/components/session-header';
import { useRecordSession } from '~/features/session-editor/hooks/use-record-session';
import type { EditorTabValue } from '~/features/session-editor/types';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS_SM, BUTTON_ICON_LG } from '~/theme/globals';

export default function RecordPage() {
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
    const primaryColor = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');
    const destructiveColor = useColor('destructive');
    const destructiveForegroundColor = useColor('destructiveForeground');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const cardColor = useColor('card');
    const mutedColor = useColor('muted');
    const renderRecordStatus = () => {
        if (isRecordingOrPaused) {
            return (
                <TextX className="!text-2xl" style={{ fontVariant: ['tabular-nums'] }}>
                    {elapsedText}
                </TextX>
            );
        }
        return <TextX style={{ color: mutedTextColor }}>点击右侧开始录制</TextX>;
    };

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-1">
                <View className="flex-1 px-4 pt-4">
                    <SessionHeader
                        displayName={displayName}
                        onChangeDisplayName={setDisplayName}
                        textColor={textColor}
                        mutedTextColor={mutedTextColor}
                        headerAtMs={headerAtMs}
                    />

                    <View className="mt-3 flex-1">
                        <Tabs value={editorTab} onValueChange={value => setEditorTab(value as EditorTabValue)} className="flex-1">
                            <TabsList radius={BORDER_RADIUS_SM} style={{ backgroundColor: mutedColor }}>
                                <TabsTrigger
                                    value="remark"
                                    icon={DesignPencil}
                                    iconProps={{ width: BUTTON_ICON_LG, height: BUTTON_ICON_LG }}>
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

                            <TabsContent value="remark" className="flex-1">
                                <RichNoteEditor placeholder="编辑录音备注" inputRef={noteInputRef} />
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
                                <TextX style={{ color: mutedTextColor }}>总结功能即将上线</TextX>
                            </TabsContent>
                        </Tabs>
                    </View>
                </View>

                <View className="flex-shrink-0 rounded-t-3xl" style={{ backgroundColor: cardColor }}>
                    <View className="flex-row items-center gap-3 p-3 pb-4">
                        {isIdleLike ? (
                            <IconButton
                                circular
                                backgroundColor={mutedColor}
                                disabled={isStopping || actionLoading}
                                onPress={handleBackPress}
                                icon={ArrowLeft}
                                iconProps={{ color: textColor }}
                            />
                        ) : canStop ? (
                            <IconButton
                                circular
                                backgroundColor={destructiveColor}
                                disabled={isStopping}
                                onPress={handleConfirmStop}
                                icon={Square}
                                iconProps={{ color: destructiveForegroundColor }}
                            />
                        ) : (
                            <IconButton
                                circular
                                backgroundColor={mutedColor}
                                disabled
                                icon={Square}
                                iconProps={{ color: destructiveColor }}
                            />
                        )}

                        <View className="flex-1 items-center justify-center">{renderRecordStatus()}</View>

                        <IconButton
                            circular
                            backgroundColor={isMicVisualState ? primaryColor : mutedColor}
                            onPress={handleLeftAction}
                            icon={isIdleLike ? Mic : isPaused ? PlayIcon : PauseIcon}
                            disabled={actionLoading || isStopping}
                            iconProps={{
                                color: primaryForegroundColor,
                            }}
                        />
                    </View>
                    <BottomSafeAreaSpacer />
                </View>
            </View>
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
