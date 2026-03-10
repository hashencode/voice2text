import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';
import { Button } from '~/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/text';
import { View } from '~/components/ui/view';
import {
    ensureModelReady,
    getInstalledModelVersion,
    isModelDownloaded,
    SHERPA_MODEL_PRESETS,
    uninstallModel,
    type DownloadModelProgress,
    type SherpaModelId,
} from '~/modules/sherpa';
import { getCurrentModelByOutputMode, setCurrentModelByOutputMode } from '~/utils/model-selection';

type ModelItemState = {
    installed: boolean;
    version: string | null;
    busy: boolean;
    statusText: string;
    errorText: string;
};

const MODEL_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models/';

function phaseToText(progress: DownloadModelProgress): string {
    if (progress.phase === 'downloading-zip') {
        const percentText = typeof progress.percent === 'number' ? ` ${Math.round(progress.percent * 100)}%` : '';
        return `下载中${percentText}`;
    }
    if (progress.phase === 'downloading-json') {
        return '获取模型信息';
    }
    if (progress.phase === 'verifying') {
        return '校验中';
    }
    if (progress.phase === 'extracting') {
        return '解压中';
    }
    return '模型就绪';
}

export default function Setting() {
    const modelIds = useMemo(() => Object.keys(SHERPA_MODEL_PRESETS) as SherpaModelId[], []);
    const [items, setItems] = useState<Record<string, ModelItemState>>({});
    const [refreshing, setRefreshing] = useState(false);
    const [streamingCurrentModel, setStreamingCurrentModel] = useState<SherpaModelId | null>(null);
    const [nonStreamingCurrentModel, setNonStreamingCurrentModel] = useState<SherpaModelId | null>(null);
    const [selectingModelId, setSelectingModelId] = useState<SherpaModelId | null>(null);

    const setItem = useCallback((modelId: SherpaModelId, patch: Partial<ModelItemState>) => {
        setItems(prev => {
            const current: ModelItemState = prev[modelId] ?? {
                installed: false,
                version: null,
                busy: false,
                statusText: '',
                errorText: '',
            };
            return {
                ...prev,
                [modelId]: { ...current, ...patch },
            };
        });
    }, []);

    const refreshOne = useCallback(
        async (modelId: SherpaModelId) => {
            const installed = await isModelDownloaded(modelId);
            const version = installed ? await getInstalledModelVersion(modelId) : null;
            setItem(modelId, {
                installed,
                version,
                busy: false,
                statusText: installed ? '已安装' : '未安装',
                errorText: '',
            });
        },
        [setItem],
    );

    const refreshAll = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.all(modelIds.map(modelId => refreshOne(modelId)));
            setStreamingCurrentModel(getCurrentModelByOutputMode('streaming'));
            setNonStreamingCurrentModel(getCurrentModelByOutputMode('nonStreaming'));
        } finally {
            setRefreshing(false);
        }
    }, [modelIds, refreshOne]);

    useEffect(() => {
        refreshAll().catch(error => {
            console.error('[setting] refresh models failed', error);
        });
    }, [refreshAll]);

    const handleInstall = useCallback(
        async (modelId: SherpaModelId) => {
            setItem(modelId, {
                busy: true,
                errorText: '',
                statusText: '准备安装',
            });
            try {
                await ensureModelReady(modelId, {
                    baseUrl: MODEL_BASE_URL,
                    onProgress: progress => {
                        setItem(modelId, { statusText: phaseToText(progress) });
                    },
                });
                await refreshOne(modelId);
            } catch (error) {
                setItem(modelId, {
                    busy: false,
                    errorText: `安装失败: ${(error as Error).message}`,
                    statusText: '安装失败',
                });
            }
        },
        [refreshOne, setItem],
    );

    const handleUninstall = useCallback(
        async (modelId: SherpaModelId) => {
            setItem(modelId, {
                busy: true,
                errorText: '',
                statusText: '卸载中',
            });
            try {
                await uninstallModel(modelId);
                await refreshOne(modelId);
            } catch (error) {
                setItem(modelId, {
                    busy: false,
                    errorText: `卸载失败: ${(error as Error).message}`,
                    statusText: '卸载失败',
                });
            }
        },
        [refreshOne, setItem],
    );

    const handleSetCurrentModel = useCallback(
        (modelId: SherpaModelId) => {
            const outputMode = SHERPA_MODEL_PRESETS[modelId].outputMode;
            setSelectingModelId(modelId);
            try {
                setCurrentModelByOutputMode(outputMode, modelId);
                if (outputMode === 'streaming') {
                    setStreamingCurrentModel(modelId);
                } else {
                    setNonStreamingCurrentModel(modelId);
                }
            } catch (error) {
                setItem(modelId, {
                    errorText: `设置当前模型失败: ${(error as Error).message}`,
                });
            } finally {
                setSelectingModelId(null);
            }
        },
        [setItem],
    );

    const renderModelCard = useCallback(
        (modelId: SherpaModelId) => {
            const outputMode = SHERPA_MODEL_PRESETS[modelId].outputMode;
            const isCurrent = outputMode === 'streaming' ? streamingCurrentModel === modelId : nonStreamingCurrentModel === modelId;
            const item = items[modelId] ?? {
                installed: false,
                version: null,
                busy: false,
                statusText: '',
                errorText: '',
            };

            return (
                <View
                    key={modelId}
                    style={{
                        gap: 6,
                        borderWidth: 1,
                        borderColor: '#e5e7eb',
                        borderRadius: 8,
                        backgroundColor: '#fff',
                        padding: 12,
                    }}>
                    <TextX variant="subtitle">{modelId}</TextX>

                    <View className="flex flex-row items-baseline">
                        <TextX variant="description">{outputMode === 'streaming' ? '流式' : '非流式'}</TextX>
                        <TextX>/</TextX>
                        <TextX variant="description">v{item.version || ''}</TextX>
                    </View>

                    <TextX>当前模型：{isCurrent ? '是' : '否'}</TextX>

                    <View className="flex flex-row gap-x-3">
                        <Button
                            variant="secondary"
                            onPress={() => handleSetCurrentModel(modelId)}
                            loading={selectingModelId === modelId}
                            disabled={!item.installed || item.busy}>
                            {outputMode === 'streaming' ? '设置为流式输出模型' : '设置为非流式输出模型'}
                        </Button>
                        {item.installed ? (
                            <Button variant="destructive" onPress={() => handleUninstall(modelId)} loading={item.busy}>
                                卸载
                            </Button>
                        ) : (
                            <Button onPress={() => handleInstall(modelId)} loading={item.busy}>
                                安装
                            </Button>
                        )}
                    </View>

                    <View>{item.errorText ? <TextX lightColor="#dc2626">{item.errorText}</TextX> : null}</View>
                </View>
            );
        },
        [handleInstall, handleSetCurrentModel, handleUninstall, items, nonStreamingCurrentModel, selectingModelId, streamingCurrentModel],
    );

    const downloadedModelIds = modelIds.filter(modelId => items[modelId]?.installed);
    const notDownloadedModelIds = modelIds.filter(modelId => !items[modelId]?.installed);

    return (
        <DefaultLayout>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="p-4">
                <Tabs defaultValue="downloaded">
                    <TabsList scrollable={false}>
                        <TabsTrigger value="downloaded" style={{ width: '50%' }}>
                            已下载
                        </TabsTrigger>
                        <TabsTrigger value="not-downloaded" style={{ width: '50%' }}>
                            未下载
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="downloaded">
                        <ScrollView
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
                            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                            {downloadedModelIds.length === 0 ? (
                                <TextX>暂无已下载模型</TextX>
                            ) : (
                                downloadedModelIds.map(modelId => renderModelCard(modelId))
                            )}
                        </ScrollView>
                    </TabsContent>
                    <TabsContent value="not-downloaded">
                        <ScrollView
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
                            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                            {notDownloadedModelIds.length === 0 ? (
                                <TextX>暂无未下载模型</TextX>
                            ) : (
                                notDownloadedModelIds.map(modelId => renderModelCard(modelId))
                            )}
                        </ScrollView>
                    </TabsContent>
                </Tabs>
            </View>
        </DefaultLayout>
    );
}
