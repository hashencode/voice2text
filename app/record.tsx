import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useNavigation } from 'expo-router';
import { ChatBubbleTranslate, DesignPencil, Post } from 'iconoir-react-native';
import {
    ArrowLeft,
    Bold,
    CalendarDays,
    Heading1,
    Heading2,
    Heading3,
    Italic,
    List,
    ListOrdered,
    ListTodo,
    Mic,
    Pause,
    Play,
    Quote,
    Square,
    Strikethrough,
    Underline,
} from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { EnrichedTextInput, type EnrichedTextInputInstance, type OnChangeStateEvent } from 'react-native-enriched';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { ModeToggle } from '~/components/ui/mode-toggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { getCurrentRecordingFolderName } from '~/db/mmkv/app-config';
import { upsertRecordingMeta } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { useKeyboardHeight } from '~/hooks/useKeyboardHeight';
import { useWavRecording } from '~/hooks/useWavRecording';
import { BORDER_RADIUS, BORDER_RADIUS_SM, BUTTON_ICON_LG, FONT_SIZE } from '~/theme/globals';

function getRecordingsDir(folderName?: string | null): string {
    if (!FileSystem.documentDirectory) {
        throw new Error('文件系统目录不可用');
    }
    const baseDir = `${FileSystem.documentDirectory}recordings/`;
    if (!folderName) {
        return baseDir;
    }
    return `${baseDir}${folderName}/`;
}

function createRecordingPath(folderName?: string | null): string {
    const fileName = `record-${Date.now()}.wav`;
    return `${getRecordingsDir(folderName)}${fileName}`;
}

function formatRecordHeaderDate(ms: number): string {
    const date = new Date(ms);
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
}

type EditorTabValue = 'remark' | 'transcript' | 'summary';
type ToolbarStateKey = keyof OnChangeStateEvent;
const TOOLBAR_ICON_SIZE = 20;

export default function RecordPage() {
    const [confirmDialogState, setConfirmDialogState] = React.useState<{
        isVisible: boolean;
        title: string;
        description: string;
        confirmText: string;
        confirmButtonProps?: { variant?: 'primary' | 'destructive' };
        onConfirm?: () => void;
        onCancel?: () => void;
    }>({
        isVisible: false,
        title: '',
        description: '',
        confirmText: '确定',
    });
    const [displayName, setDisplayName] = React.useState('新录音');
    const [, setNoteText] = React.useState('');
    const [noteStyleState, setNoteStyleState] = React.useState<OnChangeStateEvent | null>(null);
    const [editorTab, setEditorTab] = React.useState<EditorTabValue>('remark');
    const [isNoteFocused, setIsNoteFocused] = React.useState(false);
    const [recordHeaderAtMs, setRecordHeaderAtMs] = React.useState(() => Date.now());
    const noteInputRef = React.useRef<EnrichedTextInputInstance | null>(null);
    const isToolbarPressingRef = React.useRef(false);
    const recordingStartedAtRef = React.useRef<number | null>(null);

    const navigation = useNavigation();
    const { toast } = useToast();
    const { keyboardHeight, isKeyboardVisible } = useKeyboardHeight();
    const primaryColor = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');
    const destructiveColor = useColor('destructive');
    const destructiveForegroundColor = useColor('destructiveForeground');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const cardColor = useColor('card');
    const mutedColor = useColor('muted');

    const focusNoteInput = React.useCallback(() => {
        requestAnimationFrame(() => {
            noteInputRef.current?.focus?.();
        });
    }, []);

    const applyEditorAction = React.useCallback(
        (action: () => void) => {
            action();
            setEditorTab('remark');
            if (!isNoteFocused) {
                focusNoteInput();
            }
        },
        [focusNoteInput, isNoteFocused],
    );

    const showRecordError = (description: string) => {
        toast({
            title: '录音失败',
            description,
            variant: 'error',
            duration: 5000,
        });
    };

    const { phase, isPaused, actionLoading, elapsedText, startRecord, pauseRecord, resumeRecord, stopRecord } = useWavRecording({
        sampleRate: 16000,
        createTargetPath: async () => {
            const recordingFolderName = getCurrentRecordingFolderName();
            const directory = getRecordingsDir(recordingFolderName);
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            return createRecordingPath(recordingFolderName);
        },
        onStart: () => {
            const startedAt = Date.now();
            recordingStartedAtRef.current = startedAt;
            setRecordHeaderAtMs(startedAt);
        },
        onStop: async wavResult => {
            if (!wavResult.path) {
                showRecordError('未能获取录音文件，请重试');
                return;
            }

            const durationMs = wavResult.sampleRate > 0 ? Math.round((wavResult.numSamples / wavResult.sampleRate) * 1000) : null;
            const sessionId = wavResult.sessionId?.trim() || undefined;

            try {
                const recordedAtMs = recordingStartedAtRef.current ?? Date.now();
                await upsertRecordingMeta({
                    path: wavResult.path,
                    sampleRate: wavResult.sampleRate,
                    numSamples: wavResult.numSamples,
                    durationMs,
                    recordedAtMs,
                    sessionId,
                });

                toast({
                    title: '录音已保存',
                    variant: 'success',
                    duration: 3000,
                });
            } catch (error) {
                console.error('[record] upsertRecordingMeta failed', error);
                showRecordError('录音已生成，但保存元数据失败');
            } finally {
                recordingStartedAtRef.current = null;
            }
        },
        onPermissionDenied: () => {
            showRecordError('麦克风权限被拒绝');
        },
        onError: error => {
            console.error('[record] recording error', error);
            showRecordError(error.message || '录音过程中发生错误');
        },
    });

    const isRecordingOrPaused = phase === 'recording' || phase === 'paused' || phase === 'stopping';
    const isStopping = phase === 'stopping';
    const canStop = phase === 'recording' || phase === 'paused';
    const isIdleLike = phase === 'idle' || phase === 'error';
    const isMicVisualState = isIdleLike || isStopping;

    const handleLeftAction = () => {
        if (isStopping || actionLoading) {
            return;
        }
        if (isIdleLike) {
            startRecord();
            return;
        }
        if (isPaused) {
            resumeRecord();
            return;
        }
        pauseRecord();
    };

    const handleConfirmStop = () => {
        if (!canStop || isStopping) {
            return;
        }

        setConfirmDialogState({
            isVisible: true,
            title: '结束录音',
            description: '确认结束并保存当前录音吗？',
            confirmText: '结束',
            confirmButtonProps: { variant: 'destructive' },
            onConfirm: () => {
                void stopRecord();
            },
        });
    };

    const showKeyboardToolbar = editorTab === 'remark' && isKeyboardVisible && isNoteFocused;
    const RecordActionIcon = isIdleLike ? Mic : isPaused ? Play : Pause;
    const isHeadingActive = Boolean(
        noteStyleState?.h1.isActive ||
        noteStyleState?.h2.isActive ||
        noteStyleState?.h3.isActive ||
        noteStyleState?.h4.isActive ||
        noteStyleState?.h5.isActive ||
        noteStyleState?.h6.isActive,
    );

    const toolbarItems = React.useMemo(() => {
        const items: {
            key: string;
            stateKey: ToolbarStateKey;
            icon: React.ComponentType<{ size?: number; color?: string }>;
            active: boolean;
            onPress: () => void;
        }[] = [
            {
                key: 'bold',
                stateKey: 'bold',
                icon: Bold,
                active: noteStyleState?.bold.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleBold()),
            },
            {
                key: 'italic',
                stateKey: 'italic',
                icon: Italic,
                active: noteStyleState?.italic.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleItalic()),
            },
            {
                key: 'underline',
                stateKey: 'underline',
                icon: Underline,
                active: noteStyleState?.underline.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleUnderline()),
            },
            {
                key: 'strike',
                stateKey: 'strikeThrough',
                icon: Strikethrough,
                active: noteStyleState?.strikeThrough.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleStrikeThrough()),
            },
            {
                key: 'h1',
                stateKey: 'h1',
                icon: Heading1,
                active: noteStyleState?.h1.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleH1()),
            },
            {
                key: 'h2',
                stateKey: 'h2',
                icon: Heading2,
                active: noteStyleState?.h2.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleH2()),
            },
            {
                key: 'h3',
                stateKey: 'h3',
                icon: Heading3,
                active: noteStyleState?.h3.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleH3()),
            },
            {
                key: 'blockquote',
                stateKey: 'blockQuote',
                icon: Quote,
                active: noteStyleState?.blockQuote.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleBlockQuote()),
            },
            {
                key: 'ol',
                stateKey: 'orderedList',
                icon: ListOrdered,
                active: noteStyleState?.orderedList.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleOrderedList()),
            },
            {
                key: 'ul',
                stateKey: 'unorderedList',
                icon: List,
                active: noteStyleState?.unorderedList.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleUnorderedList()),
            },
            {
                key: 'checkbox',
                stateKey: 'checkboxList',
                icon: ListTodo,
                active: noteStyleState?.checkboxList.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleCheckboxList(false)),
            },
        ];

        return items.map(item => {
            const styleState = noteStyleState?.[item.stateKey];
            return {
                ...item,
                blocked: Boolean(isHeadingActive && styleState?.isBlocking),
            };
        });
    }, [applyEditorAction, isHeadingActive, noteStyleState]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', event => {
            if (!canStop || isStopping) {
                return;
            }

            event.preventDefault();
            setConfirmDialogState({
                isVisible: true,
                title: '结束录音',
                description: '当前正在录音，是否结束并返回？',
                confirmText: '结束并返回',
                confirmButtonProps: { variant: 'destructive' },
                onConfirm: () => {
                    void (async () => {
                        try {
                            await stopRecord();
                            navigation.dispatch(event.data.action);
                        } catch {
                            // stopRecord already reports errors via toast
                        }
                    })();
                },
            });
        });

        return unsubscribe;
    }, [navigation, canStop, isStopping, stopRecord]);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex flex-1">
                <View className="mb-2 flex-row items-center justify-end px-4">
                    <ModeToggle />
                </View>

                <View className="flex-1 px-4">
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
                            <TextX style={{ color: mutedTextColor }}>{formatRecordHeaderDate(recordHeaderAtMs)}</TextX>
                        </View>
                    </View>

                    <View className="mt-3 flex-1">
                        <Tabs
                            value={editorTab}
                            onValueChange={value => setEditorTab(value as EditorTabValue)}
                            contentSwitchDelayMs={180}
                            style={{ flex: 1 }}>
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

                            <TabsContent value="remark" style={{ flex: 1 }}>
                                <EnrichedTextInput
                                    ref={noteInputRef}
                                    onFocus={() => setIsNoteFocused(true)}
                                    onBlur={() => {
                                        if (isToolbarPressingRef.current) {
                                            return;
                                        }
                                        setIsNoteFocused(false);
                                    }}
                                    onChangeText={event => setNoteText(event.nativeEvent.value)}
                                    onChangeState={event => setNoteStyleState(event.nativeEvent)}
                                    style={{
                                        flex: 1,
                                        fontSize: FONT_SIZE,
                                        color: textColor,
                                    }}
                                    placeholder="编辑录音备注"
                                    placeholderTextColor={mutedTextColor}
                                    selectionColor="rgba(0,0,0,0.1)"
                                    htmlStyle={{
                                        a: { color: primaryColor, textDecorationLine: 'underline' },
                                        code: { color: textColor, backgroundColor: mutedColor },
                                        h1: { fontSize: 20, bold: true },
                                        ul: { marginLeft: 10, gapWidth: 6 },
                                        ulCheckbox: { marginLeft: 10, gapWidth: 6 },
                                    }}
                                />
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

                <View className="flex-shrink-0">
                    <View
                        className="flex-row items-center gap-3 p-3 pb-4"
                        style={{
                            backgroundColor: cardColor,
                            borderStartStartRadius: BORDER_RADIUS,
                            borderEndStartRadius: BORDER_RADIUS,
                        }}>
                        {isIdleLike ? (
                            <Pressable onPress={() => navigation.goBack()} disabled={isStopping || actionLoading}>
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
                            <View
                                className="h-12 w-12 items-center justify-center rounded-full"
                                style={{ backgroundColor: mutedColor, opacity: 0.5 }}>
                                <Square size={20} color={destructiveColor} />
                            </View>
                        )}

                        <View className="flex-1 items-center justify-center">
                            {isIdleLike ? (
                                <TextX style={{ color: mutedTextColor }}>点击右侧开始录制</TextX>
                            ) : isRecordingOrPaused ? (
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
                                <RecordActionIcon size={22} color={isMicVisualState ? primaryForegroundColor : textColor} />
                            </View>
                        </BouncyPressable>
                    </View>
                    <BottomSafeAreaSpacer />
                </View>
            </View>

            {showKeyboardToolbar ? (
                <View
                    className="absolute left-0 right-0 px-3 py-2"
                    style={{
                        bottom: keyboardHeight,
                        backgroundColor: mutedColor,
                    }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                        {toolbarItems.map(item => {
                            const IconComp = item.icon;
                            return (
                                <Pressable
                                    key={item.key}
                                    onPressIn={() => {
                                        isToolbarPressingRef.current = true;
                                    }}
                                    onPressOut={() => {
                                        requestAnimationFrame(() => {
                                            isToolbarPressingRef.current = false;
                                        });
                                    }}
                                    onPress={() => {
                                        if (item.blocked) {
                                            toast({
                                                title: '当前标题样式下不可用',
                                                description: '请先取消标题样式后再使用该格式',
                                                variant: 'error',
                                                duration: 2200,
                                            });
                                            return;
                                        }
                                        item.onPress();
                                    }}
                                    hitSlop={8}>
                                    <View
                                        className="h-[34px] w-[34px] items-center justify-center rounded-lg"
                                        style={{ opacity: item.blocked ? 0.35 : 1 }}>
                                        <IconComp
                                            size={TOOLBAR_ICON_SIZE}
                                            color={item.blocked ? mutedTextColor : item.active ? primaryColor : textColor}
                                        />
                                    </View>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            ) : null}
            <AlertDialog
                isVisible={confirmDialogState.isVisible}
                title={confirmDialogState.title}
                description={confirmDialogState.description}
                confirmText={confirmDialogState.confirmText}
                confirmButtonProps={confirmDialogState.confirmButtonProps}
                cancelText="取消"
                onConfirm={confirmDialogState.onConfirm}
                onClose={() => {
                    setConfirmDialogState(prev => ({ ...prev, isVisible: false, onCancel: undefined }));
                }}
                onCancel={() => {
                    confirmDialogState.onCancel?.();
                    setConfirmDialogState(prev => ({ ...prev, isVisible: false, onCancel: undefined }));
                }}
            />
        </DefaultLayout>
    );
}
