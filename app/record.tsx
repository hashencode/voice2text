import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useNavigation } from 'expo-router';
import { Bold, Heading1, Italic, Link, List, ListTodo, Mic, Pause, Play, Square, Strikethrough } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { EnrichedTextInput, type EnrichedTextInputInstance, type OnChangeStateEvent } from 'react-native-enriched';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { Input } from '~/components/ui/input';
import { ModeToggle } from '~/components/ui/mode-toggle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { getCurrentRecordingFolderName } from '~/db/mmkv/app-config';
import { upsertRecordingMeta } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { useKeyboardHeight } from '~/hooks/useKeyboardHeight';
import { useWavRecording } from '~/hooks/useWavRecording';
import { Colors } from '~/theme/colors';
import { BORDER_RADIUS, FONT_SIZE } from '~/theme/globals';

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

type EditorTabValue = 'remark' | 'transcript' | 'summary';
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
    const [displayName, setDisplayName] = React.useState('');
    const [, setNoteText] = React.useState('');
    const [noteSelection, setNoteSelection] = React.useState({ start: 0, end: 0, text: '' });
    const [noteStyleState, setNoteStyleState] = React.useState<OnChangeStateEvent | null>(null);
    const [editorTab, setEditorTab] = React.useState<EditorTabValue>('remark');
    const [isNoteFocused, setIsNoteFocused] = React.useState(false);
    const noteInputRef = React.useRef<EnrichedTextInputInstance | null>(null);
    const isToolbarPressingRef = React.useRef(false);

    const navigation = useNavigation();
    const { toast } = useToast();
    const { keyboardHeight, isKeyboardVisible } = useKeyboardHeight();
    const primaryColor = useColor('primary');
    const destructiveColor = useColor('destructive');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const borderColor = useColor('border');
    const mutedColor = useColor('muted');
    const cardColor = useColor('card');

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
        onStart: () => {},
        onStop: async wavResult => {
            if (!wavResult.path) {
                showRecordError('未能获取录音文件，请重试');
                return;
            }

            const durationMs = wavResult.sampleRate > 0 ? Math.round((wavResult.numSamples / wavResult.sampleRate) * 1000) : null;
            const sessionId = wavResult.sessionId?.trim() || undefined;

            try {
                await upsertRecordingMeta({
                    path: wavResult.path,
                    sampleRate: wavResult.sampleRate,
                    numSamples: wavResult.numSamples,
                    durationMs,
                    recordedAtMs: Date.now(),
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

    const LeftIcon = isMicVisualState ? Mic : isPaused ? Play : Pause;
    const showKeyboardToolbar = editorTab === 'remark' && isKeyboardVisible && isNoteFocused;

    const handleLinkAction = React.useCallback(() => {
        if (noteStyleState?.link.isActive) {
            applyEditorAction(() => noteInputRef.current?.removeLink(noteSelection.start, noteSelection.end));
            return;
        }
        if (!noteSelection.text || noteSelection.start === noteSelection.end) {
            toast({ title: '请先选中要添加链接的文本', variant: 'error', duration: 2500 });
            focusNoteInput();
            return;
        }
        applyEditorAction(() =>
            noteInputRef.current?.setLink(noteSelection.start, noteSelection.end, noteSelection.text, 'https://example.com'),
        );
    }, [
        applyEditorAction,
        focusNoteInput,
        noteSelection.end,
        noteSelection.start,
        noteSelection.text,
        noteStyleState?.link.isActive,
        toast,
    ]);

    const toolbarItems = React.useMemo(
        () => [
            {
                key: 'bold',
                icon: Bold,
                active: noteStyleState?.bold.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleBold()),
            },
            {
                key: 'italic',
                icon: Italic,
                active: noteStyleState?.italic.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleItalic()),
            },
            {
                key: 'strike',
                icon: Strikethrough,
                active: noteStyleState?.strikeThrough.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleStrikeThrough()),
            },
            {
                key: 'h1',
                icon: Heading1,
                active: noteStyleState?.h1.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleH1()),
            },
            {
                key: 'ul',
                icon: List,
                active: noteStyleState?.unorderedList.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleUnorderedList()),
            },
            {
                key: 'todo',
                icon: ListTodo,
                active: noteStyleState?.checkboxList.isActive ?? false,
                onPress: () => applyEditorAction(() => noteInputRef.current?.toggleCheckboxList(false)),
            },
            {
                key: 'link',
                icon: Link,
                active: noteStyleState?.link.isActive ?? false,
                onPress: handleLinkAction,
            },
        ],
        [applyEditorAction, handleLinkAction, noteStyleState],
    );

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
        <DefaultLayout
            headTitle="录音"
            headExtra={<ModeToggle />}
            safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}
            scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 16 }}
                    keyboardShouldPersistTaps="handled">
                    <Input label="录音名称" placeholder="输入录音名称（display name）" value={displayName} onChangeText={setDisplayName} />

                    <View className="rounded-2xl p-3" style={{ backgroundColor: cardColor }}>
                        <Tabs value={editorTab} onValueChange={value => setEditorTab(value as EditorTabValue)}>
                            <TabsList>
                                <TabsTrigger value="remark" className="w-auto">
                                    备注
                                </TabsTrigger>
                                <TabsTrigger value="transcript" className="w-auto">
                                    实时转写
                                </TabsTrigger>
                                <TabsTrigger value="summary" className="w-auto">
                                    智能总结
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="remark">
                                <View className="gap-3">
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
                                        onChangeSelection={event => setNoteSelection(event.nativeEvent)}
                                        onChangeState={event => setNoteStyleState(event.nativeEvent)}
                                        style={{
                                            minHeight: 180,
                                            borderWidth: 1,
                                            borderColor,
                                            borderRadius: 12,
                                            paddingHorizontal: 12,
                                            paddingVertical: 10,
                                            fontSize: FONT_SIZE,
                                            color: textColor,
                                            textAlignVertical: 'top',
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
                                </View>
                            </TabsContent>

                            <TabsContent value="transcript">
                                <View className="gap-2">
                                    <TextX variant="subtitle">实时转写</TextX>
                                    <TextX variant="description">稍后实现：展示录音过程中的实时文本。</TextX>
                                </View>
                            </TabsContent>

                            <TabsContent value="summary">
                                <View className="gap-2">
                                    <TextX variant="subtitle">智能总结</TextX>
                                    <TextX variant="description">稍后实现：展示 AI 生成的摘要与重点。</TextX>
                                </View>
                            </TabsContent>
                        </Tabs>
                    </View>
                </ScrollView>

                <View className="flex-shrink-0">
                    <View
                        className="flex-row items-center gap-3 p-3 pb-4 shadow"
                        style={{
                            backgroundColor: cardColor,
                            borderStartStartRadius: BORDER_RADIUS,
                            borderEndStartRadius: BORDER_RADIUS,
                        }}>
                        <BouncyPressable onPress={handleLeftAction} disabled={actionLoading || isStopping} scaleIn={1.08}>
                            <View
                                className="h-12 w-12 items-center justify-center rounded-full"
                                style={{
                                    backgroundColor: isMicVisualState ? primaryColor : Colors.light.background,
                                    opacity: isStopping ? 0.5 : 1,
                                }}>
                                <LeftIcon size={22} color={isMicVisualState ? Colors.light.card : Colors.light.text} />
                            </View>
                        </BouncyPressable>

                        <View className="flex-1 items-center justify-center">
                            {isRecordingOrPaused ? (
                                <TextX style={{ fontVariant: ['tabular-nums'], fontWeight: 'regular', fontSize: 24 }}>{elapsedText}</TextX>
                            ) : (
                                <TextX style={{ color: mutedTextColor }}>点击左侧开始录音</TextX>
                            )}
                        </View>

                        {canStop ? (
                            <Pressable onPress={handleConfirmStop} disabled={isStopping}>
                                <View
                                    className="h-12 w-12 items-center justify-center rounded-full"
                                    style={{ backgroundColor: destructiveColor, opacity: isStopping ? 0.5 : 1 }}>
                                    <Square size={20} color={Colors.light.card} />
                                </View>
                            </Pressable>
                        ) : (
                            <View className="h-12 w-12" />
                        )}
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
                                    onPress={item.onPress}
                                    hitSlop={8}>
                                    <View className="h-[34px] w-[34px] items-center justify-center rounded-lg">
                                        <IconComp size={TOOLBAR_ICON_SIZE} color={item.active ? primaryColor : textColor} />
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
