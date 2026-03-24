import { useFocusEffect } from '@react-navigation/native';
import { Filter, Search, SquareCheckBig } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import FileListItem from '~/components/home/FileListItem';
import { Picker } from '~/components/ui/picker';
import { PullToRefreshScrollView } from '~/components/ui/pull-to-refresh-scrollview';
import { Separator } from '~/components/ui/separator';
import { listRecordingMeta } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';
import { BORDER_RADIUS } from '~/theme/globals';
import { formatDate, formatDuration } from '~/utils/format';

type HomeRecordingItem = {
    path: string;
    durationMs: number | null;
    recordedAtMs: number | null;
};

const ALL_FOLDERS_KEY = '__all_folders__';

function extractFileName(path: string): string {
    const name = path.split('/').pop() ?? path;
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex <= 0) {
        return name;
    }
    return name.slice(0, dotIndex);
}

function extractFolder(path: string): string {
    const normalizedPath = path.replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
        return '根目录';
    }
    return parts[parts.length - 2] ?? '根目录';
}

export default function FileList() {
    const [items, setItems] = React.useState<HomeRecordingItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedFolder, setSelectedFolder] = React.useState<string>(ALL_FOLDERS_KEY);
    const textColor = useColor('text');
    const secondaryColor = useColor('secondary');
    const cardColor = useColor('card');

    const refreshList = React.useCallback(async (mode: 'focus' | 'pull' = 'focus') => {
        if (mode === 'focus') {
            setLoading(true);
        }
        try {
            const rows = await listRecordingMeta();
            setItems(
                rows.map(item => ({
                    path: item.path,
                    durationMs: item.durationMs,
                    recordedAtMs: item.recordedAtMs,
                })),
            );
        } catch (error) {
            setItems([]);
            if (mode === 'pull') {
                throw error;
            }
        } finally {
            if (mode === 'focus') {
                setLoading(false);
            }
        }
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            refreshList('focus').catch(() => {
                setItems([]);
                setLoading(false);
            });
        }, [refreshList]),
    );

    const onPullRefresh = React.useCallback(() => refreshList('pull'), [refreshList]);
    const folderOptions = React.useMemo(() => {
        const folderSet = new Set<string>();
        items.forEach(item => {
            folderSet.add(extractFolder(item.path));
        });
        return [
            { label: '全部文件夹', value: ALL_FOLDERS_KEY },
            ...Array.from(folderSet)
                .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
                .map(folder => ({ label: folder, value: folder })),
        ];
    }, [items]);

    const filteredItems = React.useMemo(() => {
        if (selectedFolder === ALL_FOLDERS_KEY) {
            return items;
        }
        return items.filter(item => extractFolder(item.path) === selectedFolder);
    }, [items, selectedFolder]);

    return (
        <View className="flex-1">
            <View
                className="flex-row items-center justify-between px-4 pb-1 pt-3"
                style={{ backgroundColor: cardColor, borderTopStartRadius: BORDER_RADIUS, borderTopEndRadius: BORDER_RADIUS }}>
                <View className="w-1/2">
                    <Picker
                        options={folderOptions}
                        value={selectedFolder}
                        onValueChange={value => {
                            setSelectedFolder(value);
                        }}
                        variant="outline"
                        modalTitle="选择文件夹"
                        placeholder="全部文件夹"
                    />
                </View>
                <View className="flex-row items-center gap-x-2">
                    <Pressable
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: secondaryColor }}
                        onPress={() => {}}>
                        <Filter size={16} color={textColor} />
                    </Pressable>
                    <Pressable
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: secondaryColor }}
                        onPress={() => {}}>
                        <Search size={16} color={textColor} />
                    </Pressable>
                    <Pressable
                        className="h-9 w-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: secondaryColor }}
                        onPress={() => {}}>
                        <SquareCheckBig size={16} color={textColor} />
                    </Pressable>
                </View>
            </View>
            <PullToRefreshScrollView
                onRefresh={onPullRefresh}
                isEmpty={!loading && filteredItems.length === 0}
                emptyText="暂无录音文件"
                isLoadedAll={!loading && filteredItems.length > 0}
                loadedAllText="已加载全部录音">
                {filteredItems?.map((item, index) => (
                    <React.Fragment key={item.path}>
                        <FileListItem
                            name={extractFileName(item.path)}
                            durationText={formatDuration(item.durationMs)}
                            createdAtText={formatDate(item.recordedAtMs)}
                        />
                        {index < filteredItems.length - 1 ? <Separator /> : null}
                    </React.Fragment>
                ))}
            </PullToRefreshScrollView>
        </View>
    );
}
