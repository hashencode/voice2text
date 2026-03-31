import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useNavigation } from 'expo-router';
import { Mic, Pause, Play, Square } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';
import { ModeToggle } from '~/components/ui/mode-toggle';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { getCurrentRecordingFolderName } from '~/db/mmkv/app-config';
import { upsertRecordingMeta } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { useWavRecording } from '~/hooks/useWavRecording';
import { Colors } from '~/theme/colors';
import { BORDER_RADIUS } from '~/theme/globals';

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

    const navigation = useNavigation();
    const { toast } = useToast();
    const primaryColor = useColor('primary');
    const destructiveColor = useColor('destructive');
    const mutedTextColor = useColor('textMuted');
    const cardColor = useColor('card');

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
                <View className="flex-grow" />

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
                                className="items-center justify-center rounded-full"
                                style={{
                                    width: 48,
                                    height: 48,
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
                                    className="items-center justify-center rounded-full"
                                    style={{ width: 48, height: 48, backgroundColor: destructiveColor, opacity: isStopping ? 0.5 : 1 }}>
                                    <Square size={20} color={Colors.light.card} />
                                </View>
                            </Pressable>
                        ) : (
                            <View style={{ width: 48, height: 48 }} />
                        )}
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
