import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ChatBubbleTranslate, DesignPencil, Post, UndoAction } from 'iconoir-react-native';
import { ArrowLeft, Gauge, RotateCcw, Square } from 'lucide-react-native';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import type { EnrichedTextInputInstance, OnChangeStateEvent } from 'react-native-enriched';
import Animated from 'react-native-reanimated';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { ButtonX } from '~/components/ui/buttonx';
import { Picker } from '~/components/ui/picker';
import { Progress } from '~/components/ui/progress';
import { LoadingOverlay } from '~/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import EditorKeyboardToolbar from '~/features/editor/editor-keyboard-toolbar';
import RichNoteEditor from '~/features/editor/rich-note-editor';
import SessionHeader from '~/features/session-editor/components/session-header';
import { useImportAudioSession } from '~/features/session-editor/hooks/use-import-audio-session';
import { formatTime } from '~/features/session-editor/services/time-format';
import type { EditorTabValue } from '~/features/session-editor/types';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS_SM, BUTTON_ICON_LG, FONT_SIZE_LG } from '~/theme/globals';

type RoundControlButtonProps = {
    backgroundColor: string;
    onPress: () => void;
    children: React.ReactNode;
};

function RoundControlButton({ backgroundColor, onPress, children }: RoundControlButtonProps) {
    return (
        <Pressable onPress={onPress}>
            <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor }}>
                {children}
            </View>
        </Pressable>
    );
}

function TimeLabel({ value, color, align = 'left' }: { value: string; color: string; align?: 'left' | 'right' }) {
    return (
        <TextX className={align === 'right' ? 'w-12 text-right' : 'w-12'} style={{ color }}>
            {value}
        </TextX>
    );
}

export default function ImportAudioPage() {
    const [isNoteFocused, setIsNoteFocused] = React.useState(false);
    const [noteStyleState, setNoteStyleState] = React.useState<OnChangeStateEvent | null>(null);
    const noteInputRef = React.useRef<EnrichedTextInputInstance | null>(null);
    const params = useLocalSearchParams<{
        uri?: string | string[];
        name?: string | string[];
        source?: string | string[];
        recordedAtMs?: string | string[];
    }>();
    const audioUri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
    const initialName = Array.isArray(params.name) ? params.name[0] : params.name;
    const source = Array.isArray(params.source) ? params.source[0] : params.source;
    const fromList = source === 'list';
    const recordedAtMsRaw = Array.isArray(params.recordedAtMs) ? params.recordedAtMs[0] : params.recordedAtMs;
    const parsedRecordedAtMs = recordedAtMsRaw ? Number(recordedAtMsRaw) : NaN;
    const initialHeaderAtMs = Number.isFinite(parsedRecordedAtMs) ? parsedRecordedAtMs : undefined;

    const {
        displayName,
        setDisplayName,
        editorTab,
        setEditorTab,
        headerAtMs,
        remarkText,
        handleRemarkTextChange,
        transcriptText,
        setTranscriptText,
        summaryText,
        setSummaryText,
        noteEditorSeed,
        isPlaybackMode,
        playbackCompleted,
        playbackRate,
        speedLabel,
        isPlaying,
        durationSec,
        displayCurrentSec,
        progressPercent,
        startPlayback,
        handleRewind,
        handleFastForward,
        handleOpenPlaybackRateSheet,
        handleStopPlayback,
        onProgressValueChange,
        onSeekStart,
        onSeekEnd,
        playbackBarAnimatedStyle,
        toolbarAnimatedStyle,
        toolbarMainRowAnimatedStyle,
        ActionSheet,
        handleBackPress,
        confirmDialogState,
        closeConfirmDialog,
        cancelConfirmDialog,
        saveOverlayVisible,
        saveOverlayLabel,
        isInitialSessionLoading,
        recognitionLanguage,
        setRecognitionLanguage,
        recognitionState,
        recognitionStatusIcon,
        recognitionStatusText,
        recognitionProgressPercent,
        isRecognitionBusy,
        recognitionPickerValue,
        reRecognitionOptions,
        cancelRecognition,
        handleReRecognitionModeChange,
        runOfflineRecognition,
        runOnlineRecognition,
    } = useImportAudioSession({
        audioUri,
        audioName: params.name,
        noteInputRef,
        fromList,
        initialDisplayName: fromList ? initialName : undefined,
        initialHeaderAtMs,
    });
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
    const remarkPlaceholder = fromList && isInitialSessionLoading ? '正在读取灵感' : '记录此刻灵感';
    const transcriptHasContent = transcriptText.trim().length > 0;
    const showStopRecognitionButton = recognitionState === 'preparing' || recognitionState === 'recognizing';
    const recognitionIconColor =
        recognitionStatusIcon === 'warning-triangle'
            ? destructiveColor
            : recognitionStatusIcon === 'arrow-down-circle'
              ? primaryColor
              : mutedTextColor;
    const renderPlaybackCenter = () => {
        if (!isPlaybackMode) {
            return <TextX style={{ color: mutedTextColor }}>点击右侧按钮开始播放</TextX>;
        }
        return (
            <View className="flex-row items-center gap-4">
                <RoundControlButton backgroundColor={mutedColor} onPress={handleRewind}>
                    <TextX>-5s</TextX>
                </RoundControlButton>

                <RoundControlButton backgroundColor={mutedColor} onPress={handleOpenPlaybackRateSheet}>
                    {playbackRate === 1.0 ? (
                        <Gauge size={20} strokeWidth={2} color={textColor} />
                    ) : (
                        <TextX style={{ color: primaryColor }}>{speedLabel}x</TextX>
                    )}
                </RoundControlButton>
                <RoundControlButton backgroundColor={mutedColor} onPress={handleFastForward}>
                    <TextX>+5s</TextX>
                </RoundControlButton>
            </View>
        );
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
                                    语音识别
                                </TabsTrigger>
                                <TabsTrigger value="summary" icon={Post} iconProps={{ width: BUTTON_ICON_LG, height: BUTTON_ICON_LG }}>
                                    智能总结
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="remark" className="flex-1">
                                <RichNoteEditor
                                    key={`remark-${noteEditorSeed}`}
                                    placeholder={remarkPlaceholder}
                                    inputRef={noteInputRef}
                                    initialText={remarkText}
                                    onTextChange={handleRemarkTextChange}
                                    onFocusChange={setIsNoteFocused}
                                    onStyleStateChange={setNoteStyleState}
                                />
                            </TabsContent>

                            <TabsContent value="transcript" className="flex-1">
                                {transcriptHasContent ? (
                                    <View className="flex-1">
                                        <View className="mb-3 flex-row justify-end">
                                            {showStopRecognitionButton ? (
                                                <View className="w-28">
                                                    <ButtonX size="sm" variant="destructive" onPress={() => void cancelRecognition()}>
                                                        停止识别
                                                    </ButtonX>
                                                </View>
                                            ) : (
                                                <Picker
                                                    value={recognitionPickerValue}
                                                    modalTitle="重新识别"
                                                    options={reRecognitionOptions}
                                                    onValueChange={handleReRecognitionModeChange}
                                                    disabled={isRecognitionBusy}
                                                    style={{
                                                        width: 36,
                                                        minHeight: 36,
                                                        borderWidth: 0,
                                                        backgroundColor: mutedColor,
                                                        borderRadius: 10,
                                                        paddingHorizontal: 0,
                                                        justifyContent: 'center',
                                                    }}
                                                    inputStyle={{ width: 0, opacity: 0 }}
                                                    rightComponent={<UndoAction width={18} height={18} color={textColor} />}
                                                />
                                            )}
                                        </View>
                                        <TextInput
                                            value={transcriptText}
                                            onChangeText={setTranscriptText}
                                            placeholder="编辑语音识别内容"
                                            placeholderTextColor={mutedTextColor}
                                            multiline
                                            textAlignVertical="top"
                                            className="flex-1 p-0"
                                            style={{ color: textColor, fontSize: FONT_SIZE_LG }}
                                        />
                                    </View>
                                ) : (
                                    <View className="flex-1 items-center justify-center px-4">
                                        <View className="items-center gap-3">
                                            <ChatBubbleTranslate strokeWidth={1} width={62} height={62} color={recognitionIconColor} />
                                            <TextX style={{ color: mutedTextColor }}>{recognitionStatusText}</TextX>
                                            {recognitionProgressPercent !== null ? (
                                                <TextX style={{ color: mutedTextColor }}>{recognitionProgressPercent}%</TextX>
                                            ) : null}
                                        </View>

                                        <View className="mt-5 flex w-full max-w-xs">
                                            <Picker
                                                value={recognitionLanguage}
                                                modalTitle="选择识别语言"
                                                placeholder="选择识别语言"
                                                showCancelButton
                                                cancelText="取消"
                                                disabled={isRecognitionBusy}
                                                options={[
                                                    { label: '中文', value: 'zh' },
                                                    { label: '英文', value: 'en' },
                                                ]}
                                                onValueChange={value => {
                                                    if (value === 'zh' || value === 'en') {
                                                        setRecognitionLanguage(value);
                                                    }
                                                }}
                                            />
                                        </View>

                                        {showStopRecognitionButton ? (
                                            <View className="mt-4 w-full max-w-xs">
                                                <ButtonX size="lg" variant="destructive" onPress={() => void cancelRecognition()}>
                                                    停止识别
                                                </ButtonX>
                                            </View>
                                        ) : (
                                            <View className="mt-4 w-full max-w-xs flex-row items-center gap-2">
                                                <View className="flex-1">
                                                    <ButtonX variant="secondary" size="lg" onPress={() => void runOfflineRecognition()}>
                                                        离线识别
                                                    </ButtonX>
                                                </View>
                                                <View className="flex-1">
                                                    <ButtonX size="lg" variant="primary" onPress={runOnlineRecognition}>
                                                        在线识别
                                                    </ButtonX>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </TabsContent>

                            <TabsContent value="summary">
                                <TextInput
                                    value={summaryText}
                                    onChangeText={setSummaryText}
                                    placeholder="编辑智能总结内容"
                                    placeholderTextColor={mutedTextColor}
                                    multiline
                                    textAlignVertical="top"
                                    className="flex-1 p-0 text-base"
                                    style={{ color: textColor }}
                                />
                            </TabsContent>
                        </Tabs>
                    </View>
                </View>

                <View className="flex-shrink-0 rounded-t-[26px]" style={{ backgroundColor: cardColor }}>
                    <Animated.View className="p-3" style={toolbarAnimatedStyle}>
                        <Animated.View className="flex-row items-center gap-3" style={toolbarMainRowAnimatedStyle}>
                            {isPlaybackMode ? (
                                <RoundControlButton backgroundColor={destructiveColor} onPress={() => void handleStopPlayback()}>
                                    <Square size={20} strokeWidth={2} color={destructiveForegroundColor} />
                                </RoundControlButton>
                            ) : (
                                <RoundControlButton backgroundColor={mutedColor} onPress={handleBackPress}>
                                    <ArrowLeft size={20} strokeWidth={2} color={textColor} />
                                </RoundControlButton>
                            )}

                            <View className="flex-1 items-center justify-center">{renderPlaybackCenter()}</View>

                            <BouncyPressable onPress={startPlayback} scaleIn={1.08}>
                                <View
                                    className="h-12 w-12 items-center justify-center rounded-full"
                                    style={{ backgroundColor: primaryColor }}>
                                    {playbackCompleted ? (
                                        <RotateCcw size={22} color={primaryForegroundColor} />
                                    ) : isPlaying ? (
                                        <Ionicons name="pause" size={22} color={primaryForegroundColor} />
                                    ) : (
                                        <Ionicons
                                            name="play"
                                            size={22}
                                            color={primaryForegroundColor}
                                            style={{ transform: [{ translateX: 1.5 }] }}
                                        />
                                    )}
                                </View>
                            </BouncyPressable>
                        </Animated.View>

                        <Animated.View style={playbackBarAnimatedStyle} pointerEvents={isPlaybackMode ? 'auto' : 'none'}>
                            <View className="flex-row items-center gap-3 rounded-xl px-2.5 py-2">
                                <TimeLabel value={formatTime(displayCurrentSec)} color={mutedTextColor} />
                                <View className="flex-1">
                                    <Progress
                                        value={progressPercent}
                                        interactive
                                        enableTapSeek={false}
                                        height={8}
                                        onValueChange={onProgressValueChange}
                                        onSeekStart={onSeekStart}
                                        onSeekEnd={onSeekEnd}
                                    />
                                </View>
                                <TimeLabel value={formatTime(durationSec)} color={mutedTextColor} align="right" />
                            </View>
                        </Animated.View>
                    </Animated.View>
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
                cancelText={confirmDialogState.cancelText}
                confirmButtonProps={confirmDialogState.confirmButtonProps}
                onConfirm={confirmDialogState.onConfirm}
                onClose={closeConfirmDialog}
                onCancel={cancelConfirmDialog}
                dismissible={false}
            />
            <LoadingOverlay visible={saveOverlayVisible} variant="bars" size="lg" showLabel label={saveOverlayLabel} />
            {ActionSheet}
        </DefaultLayout>
    );
}
