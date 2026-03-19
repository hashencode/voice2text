import { AudioModule, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';
import { Button } from '~/components/ui/button';
import { TextX } from '~/components/ui/text';
import { deleteRecordingMeta, listRecordingMeta, upsertRecordingMeta } from '~/db/sqlite/services/recordings.service';
import SherpaOnnx from '~/modules/sherpa';

type SavedRecordingItem = {
    path: string;
    sampleRate: number | null;
    numSamples: number | null;
    durationMs: number | null;
    recordedAtMs: number | null;
    sessionId?: string;
    reason?: string;
};

type WavFileMeta = {
    path: string;
    sampleRate: number | null;
    numSamples: number | null;
    durationMs: number | null;
    recordedAtMs: number | null;
};

function getRecordingsDir(): string {
    if (!FileSystem.documentDirectory) {
        throw new Error('文件系统目录不可用');
    }
    return `${FileSystem.documentDirectory}recordings/`;
}

function createRecordingPath(): string {
    const fileName = `record-${Date.now()}.wav`;
    return `${getRecordingsDir()}${fileName}`;
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateTime(ms: number): string {
    const date = new Date(ms);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    const second = `${date.getSeconds()}`.padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export default function RecordPage() {
    const [recordingActionLoading, setRecordingActionLoading] = useState(false);
    const [isRecordingByButton, setIsRecordingByButton] = useState(false);
    const [recordingStatusText, setRecordingStatusText] = useState('未开始录音');
    const [savedRecordings, setSavedRecordings] = useState<SavedRecordingItem[]>([]);
    const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
    const [deletingPath, setDeletingPath] = useState<string | null>(null);
    const [playingPath, setPlayingPath] = useState<string | null>(null);
    const recordingStartAtRef = useRef<number | null>(null);
    const recordingPlayer = useAudioPlayer(null, { updateInterval: 200 });
    const recordingPlayerStatus = useAudioPlayerStatus(recordingPlayer);

    const readWavMeta = useCallback(async (path: string): Promise<WavFileMeta> => {
        const fileInfo = await FileSystem.getInfoAsync(path);
        const info = await SherpaOnnx.getWavInfo(path);
        const rawModifiedAt =
            'modificationTime' in fileInfo && typeof fileInfo.modificationTime === 'number' ? fileInfo.modificationTime : null;
        const recordedAtMs = rawModifiedAt === null ? null : rawModifiedAt > 1e12 ? rawModifiedAt : rawModifiedAt * 1000;
        return {
            path,
            sampleRate: info.sampleRate,
            numSamples: info.numSamples,
            durationMs: info.durationMs,
            recordedAtMs,
        };
    }, []);

    const refreshSavedRecordings = useCallback(async () => {
        try {
            const directory = getRecordingsDir();
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            const files = await FileSystem.readDirectoryAsync(directory);
            const wavPaths = files.filter(fileName => fileName.endsWith('.wav')).map(fileName => `${directory}${fileName}`);
            const pathSet = new Set(wavPaths);
            const existingRows = await listRecordingMeta();
            const existingPathSet = new Set(existingRows.map(item => item.path));

            await Promise.all(existingRows.filter(item => !pathSet.has(item.path)).map(item => deleteRecordingMeta(item.path)));
            await Promise.all(
                wavPaths.map(async path => {
                    try {
                        const hasRow = existingPathSet.has(path);
                        if (hasRow) {
                            return;
                        }
                        const meta = await readWavMeta(path);
                        await upsertRecordingMeta(meta);
                    } catch {
                        // Ignore single-file import error.
                    }
                }),
            );

            const rows = await listRecordingMeta();
            setSavedRecordings(
                rows.map(item => ({
                    ...item,
                    sessionId: item.sessionId ?? undefined,
                    reason: item.reason ?? undefined,
                })),
            );
        } catch (error) {
            setRecordingStatusText(`读取录音列表失败: ${(error as Error).message}`);
        }
    }, [readWavMeta]);

    const startRecordingTimer = useCallback(() => {
        recordingStartAtRef.current = Date.now();
        setRecordingElapsedMs(0);
    }, []);

    const stopRecordingTimer = useCallback(() => {
        recordingStartAtRef.current = null;
        setRecordingElapsedMs(0);
    }, []);

    useEffect(() => {
        if (!isRecordingByButton) {
            return;
        }
        const timer = setInterval(() => {
            const startAt = recordingStartAtRef.current;
            if (!startAt) {
                return;
            }
            setRecordingElapsedMs(Date.now() - startAt);
        }, 200);
        return () => clearInterval(timer);
    }, [isRecordingByButton]);

    const handleDeleteRecording = useCallback(
        async (path: string) => {
            if (isRecordingByButton || deletingPath) {
                return;
            }
            setDeletingPath(path);
            try {
                await FileSystem.deleteAsync(path, { idempotent: true });
                await deleteRecordingMeta(path);
                setSavedRecordings(prev => prev.filter(item => item.path !== path));
                setRecordingStatusText('录音已删除');
            } catch (error) {
                setRecordingStatusText(`删除失败: ${(error as Error).message}`);
            } finally {
                setDeletingPath(null);
            }
        },
        [deletingPath, isRecordingByButton],
    );

    const togglePlayRecording = useCallback(
        (path: string) => {
            try {
                if (playingPath === path) {
                    if (recordingPlayerStatus.playing) {
                        recordingPlayer.pause();
                    } else {
                        recordingPlayer.play();
                    }
                    return;
                }

                recordingPlayer.replace(path);
                recordingPlayer.play();
                setPlayingPath(path);
            } catch (error) {
                setRecordingStatusText(`播放失败: ${(error as Error).message}`);
            }
        },
        [playingPath, recordingPlayer, recordingPlayerStatus.playing],
    );

    const toggleRecordAndSave = useCallback(async () => {
        if (recordingActionLoading) {
            return;
        }

        setRecordingActionLoading(true);
        try {
            if (!isRecordingByButton) {
                const permission = await AudioModule.requestRecordingPermissionsAsync();
                if (!permission.granted) {
                    setRecordingStatusText('未获得麦克风权限');
                    return;
                }

                const directory = getRecordingsDir();
                await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
                const targetPath = createRecordingPath();
                await SherpaOnnx.startWavRecording({ sampleRate: 16000, path: targetPath });
                startRecordingTimer();
                setIsRecordingByButton(true);
                setRecordingStatusText('录音中，再次点击停止并保存');
                return;
            }

            const wavResult = await SherpaOnnx.stopWavRecording();
            setIsRecordingByButton(false);
            stopRecordingTimer();
            const sessionId = wavResult.sessionId?.trim() || undefined;

            if (!wavResult.path) {
                setRecordingStatusText('停止录音失败，未拿到音频文件');
                return;
            }

            setSavedRecordings(prev => [
                {
                    path: wavResult.path,
                    sampleRate: wavResult.sampleRate,
                    numSamples: wavResult.numSamples,
                    durationMs: wavResult.sampleRate > 0 ? Math.round((wavResult.numSamples / wavResult.sampleRate) * 1000) : null,
                    recordedAtMs: Date.now(),
                    sessionId,
                },
                ...prev.filter(item => item.path !== wavResult.path),
            ]);

            try {
                await upsertRecordingMeta({
                    path: wavResult.path,
                    sampleRate: wavResult.sampleRate,
                    numSamples: wavResult.numSamples,
                    durationMs: wavResult.sampleRate > 0 ? Math.round((wavResult.numSamples / wavResult.sampleRate) * 1000) : null,
                    recordedAtMs: Date.now(),
                    sessionId,
                });
                setRecordingStatusText('录音完成，音频已保存');
            } catch (dbError) {
                console.error('[record-page] upsertRecordingMeta failed', dbError);
                setRecordingStatusText('录音已保存，索引写入失败');
            }
        } catch (error) {
            setIsRecordingByButton(false);
            stopRecordingTimer();
            setRecordingStatusText(`录音/保存失败: ${(error as Error).message}`);
        } finally {
            setRecordingActionLoading(false);
        }
    }, [isRecordingByButton, recordingActionLoading, startRecordingTimer, stopRecordingTimer]);

    useEffect(() => {
        (async () => {
            try {
                await refreshSavedRecordings();
            } catch (error) {
                setRecordingStatusText(`读取录音列表失败: ${(error as Error).message}`);
            }
        })();
    }, [refreshSavedRecordings]);

    useEffect(() => {
        return () => {
            stopRecordingTimer();
            try {
                recordingPlayer.pause();
            } catch (error) {
                // During hot-reload the shared native player may already be released.
                console.warn('[record-page] ignore player pause on cleanup', error);
            }
            if (!SherpaOnnx.isWavRecording()) {
                return;
            }
            SherpaOnnx.stopWavRecording().catch(error => {
                console.error('[record-page] stop recording on unmount failed', error);
            });
        };
    }, [recordingPlayer, stopRecordingTimer]);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-6">
                <Button loading={recordingActionLoading} onPress={toggleRecordAndSave}>
                    {isRecordingByButton ? '停止录音并保存' : '开始录音'}
                </Button>
                <TextX>录音状态：{recordingStatusText}</TextX>
                <TextX>当前录音时长：{formatDuration(recordingElapsedMs)}</TextX>

                <View className="gap-2">
                    <TextX variant="description">已保存录音：{savedRecordings.length}</TextX>
                    {savedRecordings.map(item => (
                        <View key={item.path} className="border-border rounded-xl border px-3 py-2">
                            <TextX numberOfLines={3} variant="description">
                                {item.path}
                            </TextX>
                            <TextX variant="description">{item.sampleRate ? `采样率: ${item.sampleRate} Hz` : '采样率: 未知'}</TextX>
                            <TextX variant="description">{item.numSamples !== null ? `采样点: ${item.numSamples}` : '采样点: 未知'}</TextX>
                            <TextX variant="description">
                                录音时长: {item.durationMs !== null ? formatDuration(item.durationMs) : '未知'}
                            </TextX>
                            <TextX variant="description">
                                录音日期: {item.recordedAtMs !== null ? formatDateTime(item.recordedAtMs) : '未知'}
                            </TextX>
                            {item.sessionId ? <TextX variant="description">会话: {item.sessionId}</TextX> : null}
                            {item.reason ? <TextX variant="description">恢复原因: {item.reason}</TextX> : null}
                            <View className="mt-2 flex-row justify-end">
                                <Button size="sm" variant="outline" onPress={() => togglePlayRecording(item.path)}>
                                    {playingPath === item.path && recordingPlayerStatus.playing ? '暂停' : '播放'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    loading={deletingPath === item.path}
                                    onPress={() => handleDeleteRecording(item.path)}>
                                    删除
                                </Button>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </DefaultLayout>
    );
}
