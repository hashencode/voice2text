import { Stack, useLocalSearchParams } from 'expo-router';
import { ChatBubbleTranslate, DesignPencil, Post } from 'iconoir-react-native';
import { ArrowLeft, Gauge, PauseIcon, PlayIcon, RotateCcw, Square } from 'lucide-react-native';
import React from 'react';
import { TextInput, View } from 'react-native';
import type { EnrichedTextInputInstance } from 'react-native-enriched';
import Animated from 'react-native-reanimated';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { ButtonX } from '~/components/ui/buttonx';
import { IconButton } from '~/components/ui/icon-button';
import { Picker } from '~/components/ui/picker';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import RichNoteEditor from '~/features/editor/rich-note-editor';
import SessionHeader from '~/features/session-editor/components/session-header';
import { SessionTabStatusCard } from '~/features/session-editor/components/session-tab-status-card';
import { useImportAudioSession } from '~/features/session-editor/hooks/use-import-audio-session';
import { getRecognitionPrimaryAction } from '~/features/session-editor/services/import-audio-recognition-ui';
import { formatTime } from '~/features/session-editor/services/time-format';
import type { EditorTabValue } from '~/features/session-editor/types';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS_SM, BUTTON_ICON_LG, FONT_SIZE_LG } from '~/theme/globals';

function TimeLabel({ value, color, align = 'left' }: { value: string; color: string; align?: 'left' | 'right' }) {
    return (
        <TextX className={align === 'right' ? 'w-12 text-right' : 'w-12'} style={{ color }}>
            {value}
        </TextX>
    );
}

export default function ImportAudioPage() {
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
        isInitialSessionLoading,
        recognitionLanguage,
        setRecognitionLanguage,
        recognitionMode,
        recognitionState,
        recognitionStatusIcon,
        recognitionStatusText,
        recognitionProgressPercent,
        isRecognitionBusy,
        handleRecognitionModeChange,
        startRecognition,
        cancelRecognition,
    } = useImportAudioSession({
        audioUri,
        audioName: params.name,
        noteInputRef,
        fromList,
        initialDisplayName: fromList ? initialName : undefined,
        initialHeaderAtMs,
    });
    const primaryColor = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');
    const destructiveColor = useColor('destructive');
    const destructiveForegroundColor = useColor('destructiveForeground');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const cardColor = useColor('card');
    const mutedColor = useColor('muted');
    const showStopRecognitionButton = getRecognitionPrimaryAction(recognitionState, recognitionMode) === 'stop';
    const summaryHasContent = summaryText.trim().length > 0;
    const hasRecognitionResult = transcriptText.trim().length > 0;
    const shouldShowRecognitionStatusCard = recognitionState === 'preparing' || recognitionState === 'recognizing' || recognitionState === 'failed';
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
                <IconButton circular backgroundColor={mutedColor} onPress={handleRewind}>
                    <TextX>-5s</TextX>
                </IconButton>

                <IconButton circular backgroundColor={mutedColor} onPress={handleOpenPlaybackRateSheet}>
                    {playbackRate === 1.0 ? (
                        <Gauge size={20} strokeWidth={2} color={textColor} />
                    ) : (
                        <TextX style={{ color: primaryColor }}>{speedLabel}x</TextX>
                    )}
                </IconButton>
                <IconButton circular backgroundColor={mutedColor} onPress={handleFastForward}>
                    <TextX>+5s</TextX>
                </IconButton>
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
                        editable={!isInitialSessionLoading}
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

                            {editorTab === 'transcript' ? (
                                <View className="mt-3 gap-2">
                                    <View className="flex-row items-center gap-2">
                                        <View className="flex-1">
                                            <Picker
                                                value={recognitionLanguage}
                                                modalTitle="选择识别语言"
                                                options={[
                                                    { label: '中文', value: 'zh' },
                                                    { label: '英文', value: 'en' },
                                                ]}
                                                onValueChange={value => {
                                                    if (value === 'zh' || value === 'en') {
                                                        setRecognitionLanguage(value);
                                                    }
                                                }}
                                                disabled={isRecognitionBusy}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Picker
                                                value={recognitionMode}
                                                modalTitle="选择识别模式"
                                                options={[
                                                    { label: '离线识别', value: 'offline' },
                                                    { label: '在线识别', value: 'online' },
                                                ]}
                                                onValueChange={handleRecognitionModeChange}
                                                disabled={isRecognitionBusy}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            {showStopRecognitionButton ? (
                                                <ButtonX variant="destructive" onPress={() => void cancelRecognition()}>
                                                    停止识别
                                                </ButtonX>
                                            ) : (
                                                <ButtonX variant="primary" onPress={startRecognition}>
                                                    {hasRecognitionResult ? '重新识别' : '开始识别'}
                                                </ButtonX>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ) : null}

                            <TabsContent value="remark" className="flex-1">
                                {isInitialSessionLoading ? (
                                    <View className="flex-1 justify-center">
                                        <SessionTabStatusCard Icon={DesignPencil} title="正在载入灵感" align="left" iconSize={20} />
                                    </View>
                                ) : (
                                    <RichNoteEditor
                                        key={`remark-${noteEditorSeed}`}
                                        inputRef={noteInputRef}
                                        initialText={remarkText}
                                        onTextChange={handleRemarkTextChange}
                                    />
                                )}
                            </TabsContent>

                            <TabsContent value="transcript" className="flex-1">
                                <View className="flex-1">
                                    {shouldShowRecognitionStatusCard ? (
                                        <SessionTabStatusCard
                                            Icon={ChatBubbleTranslate}
                                            iconColor={recognitionIconColor}
                                            title={recognitionStatusText}
                                            progressText={recognitionProgressPercent !== null ? `${recognitionProgressPercent}%` : null}
                                            align="left"
                                            iconSize={20}
                                        />
                                    ) : null}
                                    <TextInput
                                        value={transcriptText}
                                        onChangeText={setTranscriptText}
                                        placeholder="编辑语音识别内容"
                                        placeholderTextColor={mutedTextColor}
                                        multiline
                                        textAlignVertical="top"
                                        editable={!isRecognitionBusy}
                                        className={`${shouldShowRecognitionStatusCard ? 'mt-2 ' : ''}flex-1 p-0`}
                                        style={{ color: textColor, fontSize: FONT_SIZE_LG }}
                                    />
                                </View>
                            </TabsContent>

                            <TabsContent value="summary" className="flex-1">
                                <View className="flex-1">
                                    {!summaryHasContent ? (
                                        <SessionTabStatusCard
                                            Icon={Post}
                                            title="等待生成智能总结"
                                            description="智能总结内容将在后续能力接入后显示"
                                            align="left"
                                            iconSize={20}
                                        />
                                    ) : null}
                                    <TextInput
                                        value={summaryText}
                                        onChangeText={setSummaryText}
                                        placeholder="编辑智能总结内容"
                                        placeholderTextColor={mutedTextColor}
                                        multiline
                                        textAlignVertical="top"
                                        className="mt-2 flex-1 p-0 text-base"
                                        style={{ color: textColor }}
                                    />
                                </View>
                            </TabsContent>
                        </Tabs>
                    </View>
                </View>

                <View className="flex-shrink-0 rounded-t-3xl" style={{ backgroundColor: cardColor }}>
                    <Animated.View className="p-3" style={toolbarAnimatedStyle}>
                        <Animated.View className="flex-row items-center gap-3" style={toolbarMainRowAnimatedStyle}>
                            {isPlaybackMode ? (
                                <IconButton
                                    circular
                                    backgroundColor={destructiveColor}
                                    onPress={() => void handleStopPlayback()}
                                    icon={Square}
                                    iconProps={{ color: destructiveForegroundColor }}
                                />
                            ) : (
                                <IconButton circular backgroundColor={mutedColor} onPress={handleBackPress} icon={ArrowLeft} />
                            )}

                            <View className="flex-1 items-center justify-center">{renderPlaybackCenter()}</View>

                            <IconButton
                                circular
                                backgroundColor={primaryColor}
                                onPress={startPlayback}
                                icon={playbackCompleted ? RotateCcw : isPlaying ? PauseIcon : PlayIcon}
                                iconProps={{
                                    color: primaryForegroundColor,
                                }}
                            />
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
            {ActionSheet}
        </DefaultLayout>
    );
}
