import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { listRecordingMeta } from '~/db/sqlite/services/recordings.service';
import FileListItem from '~/components/home/FileListItem';
import { Separator } from '~/components/ui/separator';
import { TextX } from '~/components/ui/textx';
import { PullToRefreshScrollView } from '~/components/ui/pull-to-refresh-scrollview';
import { useColor } from '~/hooks/useColor';

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
    const [refreshing, setRefreshing] = React.useState(false);
    const refreshColor = useColor('primary');
    const refreshBackgroundColor = useColor('card');
    const refreshIconRotation = useSharedValue(0);
    const pullProgress = useSharedValue(0);

    const refreshList = React.useCallback(async (mode: 'focus' | 'pull' = 'focus') => {
        if (mode === 'pull') {
            setRefreshing(true);
        } else {
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
        } catch {
            setItems([]);
        } finally {
            if (mode === 'pull') {
                setRefreshing(false);
                return;
            }
            setLoading(false);
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

    const onPullRefresh = React.useCallback(() => {
        refreshList('pull').catch(() => {
            setRefreshing(false);
        });
    }, [refreshList]);

    React.useEffect(() => {
        if (refreshing) {
            refreshIconRotation.value = 0;
            refreshIconRotation.value = withRepeat(
                withTiming(360, {
                    duration: 900,
                    easing: Easing.linear,
                }),
                -1,
                false,
            );
            return;
        }
        refreshIconRotation.value = 0;
    }, [refreshIconRotation, refreshing]);

    const refreshIconStyle = useAnimatedStyle(() => {
        const degree = refreshing ? refreshIconRotation.value : pullProgress.value * 360;
        const opacity = refreshing ? 1 : 0.4 + pullProgress.value * 0.6;
        return {
            opacity,
            transform: [{ rotate: `${degree}deg` }],
        };
    });

    return (
        <PullToRefreshScrollView
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            maxPullHeight={96}
            refreshBackgroundColor={refreshBackgroundColor}
            containerBackgroundColor="transparent"
            contentContainerStyle={{ paddingBottom: 16 }}
            onPullProgress={progress => {
                pullProgress.value = progress;
            }}
            renderPullView={
                <Animated.View style={refreshIconStyle}>
                    <Ionicons name="refresh" size={22} color={refreshColor} />
                </Animated.View>
            }
            style={{ flex: 1 }}
            className="px-5">
            {loading ? (
                <View className="pt-2">
                    <TextX variant="description">加载中...</TextX>
                </View>
            ) : null}
            {!loading && items.length === 0 ? (
                <View className="pt-2">
                    <TextX variant="description">暂无录音文件</TextX>
                </View>
            ) : null}
            {!loading
                ? items.map((item, index) => (
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
                  ))
                : null}
        </PullToRefreshScrollView>
    );
}
