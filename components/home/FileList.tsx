import { useFocusEffect } from '@react-navigation/native';
import { Filter, Search, SquareCheckBig } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import FileListItem from '~/components/home/FileListItem';
import { Picker } from '~/components/ui/picker';
import { PullToRefreshScrollView } from '~/components/ui/pull-to-refresh-scrollview';
import { Separator } from '~/components/ui/separator';
import { TextX } from '~/components/ui/textx';
import { listRecordingMeta } from '~/db/sqlite/services/recordings.service';
import { useColor } from '~/hooks/useColor';

type HomeRecordingItem = {
    path: string;
    durationMs: number | null;
    recordedAtMs: number | null;
};

const ALL_FOLDERS_KEY = '__all_folders__';

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
    const refreshBackgroundColor = useColor('card');
    const textColor = useColor('text');
    const secondaryColor = useColor('secondary');

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
            <PullToRefreshScrollView
                onRefresh={onPullRefresh}
                maxPullHeight={100}
                refreshBackgroundColor={refreshBackgroundColor}
                containerBackgroundColor="transparent"
                contentContainerStyle={{ paddingBottom: 16 }}
                style={{ flex: 1 }}
                className="px-5">
                <View className="mb-4 mt-2 flex-row items-center justify-between">
                    <View className="w-[56%]">
                        <Picker
                            // options={folderOptions}
                            sections={[
                                {
                                    title: 'Fruits',
                                    options: [
                                        { label: 'Apple', value: 'apple' },
                                        { label: 'Banana', value: 'banana' },
                                        { label: 'Orange', value: 'orange' },
                                    ],
                                },
                                {
                                    title: 'Vegetables',
                                    options: [
                                        { label: 'Carrot', value: 'carrot' },
                                        { label: 'Broccoli', value: 'broccoli' },
                                        { label: 'Spinach', value: 'spinach' },
                                    ],
                                },
                            ]}
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
                {loading ? (
                    <View className="pt-2">
                        <TextX variant="description">加载中...</TextX>
                    </View>
                ) : null}
                {!loading && filteredItems.length === 0 ? (
                    <View className="pt-2">
                        <TextX variant="description">
                            {selectedFolder === ALL_FOLDERS_KEY ? '暂无录音文件' : '当前文件夹暂无录音文件'}
                        </TextX>
                    </View>
                ) : null}
                {!loading
                    ? filteredItems.map((item, index) => (
                          <React.Fragment key={item.path}>
                              <FileListItem
                                  name={extractFileName(item.path)}
                                  durationText={formatDuration(item.durationMs)}
                                  createdAtText={formatDate(item.recordedAtMs)}
                              />
                              {index < filteredItems.length - 1 ? <Separator /> : null}
                          </React.Fragment>
                      ))
                    : null}
            </PullToRefreshScrollView>
        </View>
    );
}
