import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';
import { Button } from '~/components/ui/button';
import { TextX } from '~/components/ui/text';
import { getRealtimeRecordingRootDir } from '~/modules/sherpa';

type WavFileItem = {
    path: string;
    relativePath: string;
    size: number;
    modifiedAt: number;
};

function joinUri(base: string, name: string): string {
    return `${base}${base.endsWith('/') ? '' : '/'}${name}`;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb < 1024) {
        return `${kb.toFixed(1)} KB`;
    }
    const mb = kb / 1024;
    if (mb < 1024) {
        return `${mb.toFixed(1)} MB`;
    }
    return `${(mb / 1024).toFixed(2)} GB`;
}

function formatTimestamp(timestampMs: number): string {
    if (!timestampMs || Number.isNaN(timestampMs)) {
        return '-';
    }
    return new Date(timestampMs).toLocaleString();
}

export default function WavFiles() {
    const [items, setItems] = useState<WavFileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState('加载中...');
    const [playingPath, setPlayingPath] = useState<string | null>(null);
    const player = useAudioPlayer(null, { updateInterval: 200 });
    const playerStatus = useAudioPlayerStatus(player);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        try {
            const rootDir = getRealtimeRecordingRootDir();
            const rootInfo = await FileSystem.getInfoAsync(rootDir);
            if (!rootInfo.exists || !rootInfo.isDirectory) {
                setItems([]);
                setStatusText('暂无录音文件');
                return;
            }

            const collected: WavFileItem[] = [];
            const queue: string[] = [rootDir];

            while (queue.length > 0) {
                const currentDir = queue.shift();
                if (!currentDir) {
                    continue;
                }
                const names = await FileSystem.readDirectoryAsync(currentDir);
                for (const name of names) {
                    const path = joinUri(currentDir, name);
                    const info = await FileSystem.getInfoAsync(path);
                    if (!info.exists) {
                        continue;
                    }
                    if (info.isDirectory) {
                        queue.push(`${path}/`);
                        continue;
                    }
                    if (!name.toLowerCase().endsWith('.wav')) {
                        continue;
                    }

                    const fileInfo = info as FileSystem.FileInfo & { size?: number; modificationTime?: number };
                    const fileSize = typeof fileInfo.size === 'number' ? fileInfo.size : 0;
                    const modifiedAt = typeof fileInfo.modificationTime === 'number' ? Math.trunc(fileInfo.modificationTime * 1000) : 0;
                    const relativePath = path.replace(rootDir, '');
                    collected.push({
                        path,
                        relativePath,
                        size: fileSize,
                        modifiedAt,
                    });
                }
            }

            collected.sort((left, right) => right.modifiedAt - left.modifiedAt);
            setItems(collected);
            setStatusText(collected.length > 0 ? `共 ${collected.length} 个 WAV 文件` : '暂无录音文件');
            if (playingPath && !collected.some(item => item.path === playingPath)) {
                player.pause();
                setPlayingPath(null);
            }
        } catch (error) {
            setItems([]);
            setStatusText(`读取失败: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    }, [player, playingPath]);

    useEffect(() => {
        loadFiles().catch(error => {
            setStatusText(`读取失败: ${(error as Error).message}`);
            setLoading(false);
        });
    }, [loadFiles]);

    useEffect(() => {
        if (playerStatus.didJustFinish && !playerStatus.playing) {
            setPlayingPath(null);
        }
    }, [playerStatus.didJustFinish, playerStatus.playing]);

    useEffect(() => {
        return () => {
            player.pause();
        };
    }, [player]);

    const togglePlay = useCallback(
        (path: string) => {
            try {
                if (playingPath === path) {
                    if (playerStatus.playing) {
                        player.pause();
                    } else {
                        player.play();
                    }
                    return;
                }

                player.replace(path);
                player.play();
                setPlayingPath(path);
            } catch (error) {
                setStatusText(`播放失败: ${(error as Error).message}`);
            }
        },
        [player, playerStatus.playing, playingPath],
    );

    return (
        <DefaultLayout>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-1 px-4 pb-6 pt-3">
                <View className="mb-3 flex-row items-center gap-2">
                    <Button variant="outline" onPress={loadFiles} loading={loading}>
                        刷新
                    </Button>
                    <TextX variant="description">{statusText}</TextX>
                </View>
                <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFiles} />}>
                    {items.map(item => (
                        <View key={item.path} className="border-border mb-2 rounded-xl border px-3 py-2">
                            <TextX numberOfLines={1}>{item.relativePath}</TextX>
                            <TextX variant="description">大小: {formatBytes(item.size)}</TextX>
                            <TextX variant="description">修改时间: {formatTimestamp(item.modifiedAt)}</TextX>
                            <View className="mt-2 flex-row items-center gap-2">
                                <Button size="sm" variant="outline" onPress={() => togglePlay(item.path)}>
                                    {playingPath === item.path && playerStatus.playing ? '暂停' : '播放'}
                                </Button>
                                <TextX variant="description">
                                    {playingPath === item.path ? (playerStatus.playing ? '播放中' : '已暂停') : ''}
                                </TextX>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </DefaultLayout>
    );
}
