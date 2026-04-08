import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ChatBubbleTranslate, DesignPencil, Post } from 'iconoir-react-native';
import { ArrowLeft, CalendarDays, FastForward, Gauge, Rewind, RotateCcw } from 'lucide-react-native';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { DefaultLayout } from '~/components/layout/default-layout';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import RichNoteEditor from '~/features/editor/rich-note-editor';
import { useImportAudioSession } from '~/features/session-editor/hooks/use-import-audio-session';
import { formatHeaderDate, formatTime } from '~/features/session-editor/services/time-format';
import type { EditorTabValue } from '~/features/session-editor/types';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS, BORDER_RADIUS_SM, BUTTON_ICON_LG } from '~/theme/globals';

export default function ImportAudioPage() {
    const params = useLocalSearchParams<{ uri?: string | string[]; name?: string | string[] }>();
    const audioUri = Array.isArray(params.uri) ? params.uri[0] : params.uri;

    const {
        displayName,
        setDisplayName,
        editorTab,
        setEditorTab,
        headerAtMs,
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
        onProgressValueChange,
        onSeekStart,
        onSeekEnd,
        playbackBarAnimatedStyle,
        toolbarAnimatedStyle,
        toolbarMainRowAnimatedStyle,
        ActionSheet,
        handleBackPress,
    } = useImportAudioSession({ audioUri, audioName: params.name });

    const primaryColor = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const cardColor = useColor('card');
    const mutedColor = useColor('muted');

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
                        style={{
                            color: textColor,
                            minHeight: 40,
                            lineHeight: 40,
                            paddingVertical: 0,
                            includeFontPadding: false,
                            textAlignVertical: 'center',
                        }}
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
                                    语音识别
                                </TabsTrigger>
                                <TabsTrigger value="summary" icon={Post} iconProps={{ width: BUTTON_ICON_LG, height: BUTTON_ICON_LG }}>
                                    智能总结
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="remark" style={{ flex: 1 }}>
                                <RichNoteEditor placeholder="编辑音频备注" />
                            </TabsContent>

                            <TabsContent value="transcript">
                                <TextX style={{ color: mutedTextColor }}>...</TextX>
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
                    <Animated.View className="p-3" style={toolbarAnimatedStyle}>
                        <Animated.View className="flex-row items-center gap-3" style={toolbarMainRowAnimatedStyle}>
                            {isPlaybackMode ? (
                                <View className="flex-row items-center gap-2">
                                    <Pressable onPress={handleRewind}>
                                        <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: mutedColor }}>
                                            <Rewind size={20} strokeWidth={2} color={textColor} />
                                        </View>
                                    </Pressable>
                                    <Pressable onPress={handleFastForward}>
                                        <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: mutedColor }}>
                                            <FastForward size={20} strokeWidth={2} color={textColor} />
                                        </View>
                                    </Pressable>
                                    <Pressable onPress={handleOpenPlaybackRateSheet}>
                                        <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: mutedColor }}>
                                            {playbackRate === 1.0 ? (
                                                <Gauge size={20} strokeWidth={2} color={textColor} />
                                            ) : (
                                                <TextX style={{ color: primaryColor }}>{speedLabel}x</TextX>
                                            )}
                                        </View>
                                    </Pressable>
                                </View>
                            ) : (
                                <Pressable onPress={handleBackPress}>
                                    <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: mutedColor }}>
                                        <ArrowLeft size={20} strokeWidth={2} color={textColor} />
                                    </View>
                                </Pressable>
                            )}

                            <View className="flex-1 items-center justify-center">
                                {isPlaybackMode ? (
                                    <TextX style={{ color: mutedTextColor }}>{isPlaying ? '正在播放' : '已暂停'}</TextX>
                                ) : (
                                    <TextX style={{ color: mutedTextColor }}>点击右侧开始播放</TextX>
                                )}
                            </View>

                            <BouncyPressable onPress={startPlayback} scaleIn={1.08}>
                                <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: primaryColor }}>
                                    {playbackCompleted ? (
                                        <RotateCcw size={22} color={primaryForegroundColor} />
                                    ) : isPlaying ? (
                                        <Ionicons name="pause" size={22} color={primaryForegroundColor} />
                                    ) : (
                                        <Ionicons name="play" size={22} color={primaryForegroundColor} style={{ transform: [{ translateX: 1.5 }] }} />
                                    )}
                                </View>
                            </BouncyPressable>
                        </Animated.View>

                        <Animated.View style={playbackBarAnimatedStyle} pointerEvents={isPlaybackMode ? 'auto' : 'none'}>
                            <View className="flex-row items-center gap-3 rounded-xl px-2.5 py-2">
                                <TextX style={{ color: mutedTextColor, width: 48 }}>{formatTime(displayCurrentSec)}</TextX>
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
                                <TextX style={{ color: mutedTextColor, width: 48, textAlign: 'right' }}>{formatTime(durationSec)}</TextX>
                            </View>
                        </Animated.View>
                    </Animated.View>
                    <BottomSafeAreaSpacer />
                </View>
            </View>
            {ActionSheet}
        </DefaultLayout>
    );
}
