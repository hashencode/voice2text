import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { listRecordingMeta } from '~/db/sqlite/services/recordings.service';
import FileListItem from '~/components/home/FileListItem';
import { Separator } from '~/components/ui/separator';
import { TextX } from '~/components/ui/textx';

type HomeRecordingItem = {
    path: string;
    durationMs: number | null;
    recordedAtMs: number | null;
};

function formatDuration(ms: number | null): string {
    if (ms === null || ms < 0) {
        return '未知时长';
    }
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(ms: number | null): string {
    if (ms === null || ms <= 0) {
        return '未知日期';
    }
    const date = new Date(ms);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

function extractFileName(path: string): string {
    const name = path.split('/').pop() ?? path;
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex <= 0) {
        return name;
    }
    return name.slice(0, dotIndex);
}

export default function FileList() {
    const [items, setItems] = React.useState<HomeRecordingItem[]>([]);
    const [loading, setLoading] = React.useState(true);

    const refreshList = React.useCallback(async () => {
        setLoading(true);
        try {
            const rows = await listRecordingMeta();
            setItems(
                rows.map(item => ({
                    path: item.path,
                    durationMs: item.durationMs,
                    recordedAtMs: item.recordedAtMs,
                })),
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            refreshList().catch(() => {
                setItems([]);
                setLoading(false);
            });
        }, [refreshList]),
    );

    if (loading) {
        return (
            <View className="px-5 pt-2">
                <TextX variant="description">加载中...</TextX>
            </View>
        );
    }

    if (items.length === 0) {
        return (
            <View className="px-5 pt-2">
                <TextX variant="description">暂无录音文件</TextX>
            </View>
        );
    }

    return (
        <ScrollView className="px-5">
            {items.map((item, index) => (
                <React.Fragment key={item.path}>
                    <FileListItem
                        name={extractFileName(item.path)}
                        durationText={formatDuration(item.durationMs)}
                        createdAtText={formatDate(item.recordedAtMs)}
                    />
                    {index < items.length - 1 ? (
                        <View className="my-4">
                            <Separator />
                        </View>
                    ) : null}
                </React.Fragment>
            ))}
        </ScrollView>
    );
}
