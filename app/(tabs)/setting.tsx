import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { ButtonX } from '~/components/ui/buttonx';
import { SwitchX } from '~/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import { View } from '~/components/ui/view';
import {
    getDenoiseEnabled,
    getRecognitionProfile,
    getSpeakerDiarizationEnabled,
    setDenoiseEnabled,
    setRecognitionProfile,
    setSpeakerDiarizationEnabled,
    type RecognitionProfileId,
} from '~/db/mmkv/app-config';
import { getCurrentModel, setCurrentModel } from '~/db/mmkv/model-selection';
import {
    ensureModelReady,
    getInstalledModelVersion,
    isModelDownloaded,
    SHERPA_MODEL_PRESETS,
    type DownloadModelProgress,
    type SherpaModelId,
} from '~/modules/sherpa';
import { MIN_MODEL_VERSION_BY_MODEL_ID } from '~/scripts/const';

type ModelItemState = {
    installed: boolean;
    version: string | null;
    busy: boolean;
    statusText: string;
    errorText: string;
};

const MODEL_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models/';

const PROFILE_MODEL_MAPPING: Record<
    RecognitionProfileId,
    {
        model: SherpaModelId;
    }
> = {
    'zh-cn': {
        model: 'zh',
    },
    en: {
        model: 'en',
    },
    universal: {
        model: 'universal',
    },
};

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
    const [currentModel, setCurrentModelState] = useState<SherpaModelId | null>(null);
    const [selectingModelId, setSelectingModelId] = useState<SherpaModelId | null>(null);
    const [speakerDiarizationEnabled, setSpeakerDiarizationEnabledState] = useState(getSpeakerDiarizationEnabled());
    const [denoiseEnabled, setDenoiseEnabledState] = useState(getDenoiseEnabled());
    const [recognitionProfile, setRecognitionProfileState] = useState<RecognitionProfileId>(getRecognitionProfile());

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
            const installedVersion = installed ? await getInstalledModelVersion(modelId) : null;
            const version = installedVersion ?? MIN_MODEL_VERSION_BY_MODEL_ID[modelId] ?? null;
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
            setCurrentModelState(getCurrentModel());
            setRecognitionProfileState(getRecognitionProfile());
        } finally {
            setRefreshing(false);
        }
    }, [modelIds, refreshOne]);

    useEffect(() => {
        refreshAll().catch(error => {
            console.error('[setting] refresh models failed', error);
        });
    }, [refreshAll]);

    const handleToggleSpeakerDiarization = useCallback((value: boolean) => {
        setSpeakerDiarizationEnabled(value);
        setSpeakerDiarizationEnabledState(value);
    }, []);

    const handleToggleDenoise = useCallback((value: boolean) => {
        setDenoiseEnabled(value);
        setDenoiseEnabledState(value);
    }, []);

    const handleRecognitionProfileChange = useCallback((value: string) => {
        if (value !== 'zh-cn' && value !== 'en' && value !== 'universal') {
            return;
        }
        const profile = value as RecognitionProfileId;
        const mapping = PROFILE_MODEL_MAPPING[profile];

        setRecognitionProfile(profile);
        setRecognitionProfileState(profile);
        setCurrentModel(mapping.model);
        setCurrentModelState(mapping.model);
    }, []);

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

    const handleSetCurrentModel = useCallback(
        (modelId: SherpaModelId) => {
            setSelectingModelId(modelId);
            try {
                setCurrentModel(modelId);
                setCurrentModelState(modelId);
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
            const isCurrent = currentModel === modelId;
            const item = items[modelId] ?? {
                installed: false,
                version: null,
                busy: false,
                statusText: '',
                errorText: '',
            };

            return (
                <View key={modelId} className="gap-1.5 rounded-lg border border-[#e5e7eb] p-3">
                    <View className="flex flex-row items-center justify-between gap-x-2">
                        <TextX variant="title">{modelId}</TextX>
                        <View className="flex flex-row items-center gap-x-2">
                            {item.installed ? (
                                <ButtonX
                                    variant={isCurrent ? 'primary' : 'secondary'}
                                    onPress={() => handleSetCurrentModel(modelId)}
                                    loading={selectingModelId === modelId}>
                                    {isCurrent ? '已应用' : '应用'}
                                </ButtonX>
                            ) : (
                                <ButtonX onPress={() => handleInstall(modelId)} loading={item.busy}>
                                    安装
                                </ButtonX>
                            )}
                        </View>
                    </View>

                    <View>{item.errorText ? <TextX lightColor="#dc2626">{item.errorText}</TextX> : null}</View>
                </View>
            );
        },
        [currentModel, handleInstall, handleSetCurrentModel, items, selectingModelId],
    );

    return (
        <DefaultLayout>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="p-4">
                <View className="mb-3 gap-2.5 rounded-lg border border-[#e5e7eb] p-3">
                    <TextX variant="subtitle">识别配置</TextX>
                    <View className="flex flex-row items-center justify-between">
                        <TextX>说话人分离开关：{speakerDiarizationEnabled ? '开启' : '关闭'}</TextX>
                        <SwitchX value={speakerDiarizationEnabled} onValueChange={handleToggleSpeakerDiarization} />
                    </View>
                    <View className="flex flex-row items-center justify-between">
                        <TextX>降噪开关：{denoiseEnabled ? '开启' : '关闭'}</TextX>
                        <SwitchX value={denoiseEnabled} onValueChange={handleToggleDenoise} />
                    </View>
                    <View className="gap-2">
                        <TextX>识别语言配置</TextX>
                        <Tabs value={recognitionProfile} onValueChange={handleRecognitionProfileChange}>
                            <TabsList>
                                <TabsTrigger value="zh-cn" className="w-auto">
                                    zh-cn
                                </TabsTrigger>
                                <TabsTrigger value="en" className="w-auto">
                                    en
                                </TabsTrigger>
                                <TabsTrigger value="universal" className="w-auto">
                                    universal
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </View>
                </View>
                <ScrollView
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
                    contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                    {modelIds.map(modelId => renderModelCard(modelId))}
                </ScrollView>
            </View>
        </DefaultLayout>
    );
}
