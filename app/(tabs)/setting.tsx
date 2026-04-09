import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { ButtonX } from '~/components/ui/buttonx';
import { SwitchX } from '~/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { TextX } from '~/components/ui/textx';
import { View } from '~/components/ui/view';
import {
    getDenoiseEnabled,
    getFinalTranscribeUseSpeakerDiarization,
    getFinalTranscribeUseVad,
    getSpeakerDiarizationEnabled,
    getVadEngine,
    setDenoiseEnabled,
    setFinalTranscribeUseSpeakerDiarization,
    setFinalTranscribeUseVad,
    setSpeakerDiarizationEnabled,
    setVadEngine,
    type VadEngineId,
} from '~/data/mmkv/app-config';
import { getCurrentModel, setCurrentModel } from '~/data/mmkv/model-selection';
import {
    ensureModelReady,
    getInstalledModelVersion,
    importModelZipForTesting,
    isModelDownloaded,
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
const MODEL_IDS: SherpaModelId[] = ['moonshine-zh', 'paraformer-zh'];

function createDefaultModelItemState(): ModelItemState {
    return {
        installed: false,
        version: null,
        busy: false,
        statusText: '',
        errorText: '',
    };
}

function isSherpaModelId(value: string): value is SherpaModelId {
    return MODEL_IDS.includes(value as SherpaModelId);
}

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
    const [refreshing, setRefreshing] = useState(false);
    const [speakerDiarizationEnabled, setSpeakerDiarizationEnabledState] = useState(getSpeakerDiarizationEnabled());
    const [denoiseEnabled, setDenoiseEnabledState] = useState(getDenoiseEnabled());
    const [vadEngine, setVadEngineState] = useState<VadEngineId>(getVadEngine());
    const [finalTranscribeUseVad, setFinalTranscribeUseVadState] = useState(getFinalTranscribeUseVad());
    const [finalTranscribeUseSpeakerDiarization, setFinalTranscribeUseSpeakerDiarizationState] = useState(
        getFinalTranscribeUseSpeakerDiarization(),
    );
    const [currentModelId, setCurrentModelId] = useState<SherpaModelId>(getCurrentModel());
    const [modelItems, setModelItems] = useState<Record<SherpaModelId, ModelItemState>>({
        'moonshine-zh': createDefaultModelItemState(),
        'paraformer-zh': createDefaultModelItemState(),
    });
    const modelItem = modelItems[currentModelId];

    const refreshModel = useCallback(async (modelId: SherpaModelId) => {
        const installed = await isModelDownloaded(modelId);
        const installedVersion = installed ? await getInstalledModelVersion(modelId) : null;
        const version = installedVersion ?? MIN_MODEL_VERSION_BY_MODEL_ID[modelId] ?? null;
        setModelItems(prev => ({
            ...prev,
            [modelId]: {
                installed,
                version,
                busy: false,
                statusText: installed ? '已安装' : '未安装',
                errorText: '',
            },
        }));
    }, []);

    const refreshAll = useCallback(async () => {
        setRefreshing(true);
        try {
            const nextModelId = getCurrentModel();
            setCurrentModelId(nextModelId);
            await Promise.all(MODEL_IDS.map(modelId => refreshModel(modelId)));
            setVadEngineState(getVadEngine());
            setFinalTranscribeUseVadState(getFinalTranscribeUseVad());
            setFinalTranscribeUseSpeakerDiarizationState(getFinalTranscribeUseSpeakerDiarization());
        } finally {
            setRefreshing(false);
        }
    }, [refreshModel]);

    useEffect(() => {
        refreshAll().catch(error => {
            console.error('[setting] refresh state failed', error);
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

    const handleVadEngineChange = useCallback((value: string) => {
        if (value !== 'tenvad' && value !== 'silerovad') {
            return;
        }
        const engine = value as VadEngineId;
        setVadEngine(engine);
        setVadEngineState(engine);
    }, []);

    const handleToggleFinalTranscribeUseVad = useCallback((value: boolean) => {
        setFinalTranscribeUseVad(value);
        setFinalTranscribeUseVadState(value);
    }, []);

    const handleToggleFinalTranscribeUseSpeakerDiarization = useCallback((value: boolean) => {
        setFinalTranscribeUseSpeakerDiarization(value);
        setFinalTranscribeUseSpeakerDiarizationState(value);
    }, []);

    const handleModelChange = useCallback((value: string) => {
        if (!isSherpaModelId(value)) {
            return;
        }
        setCurrentModel(value);
        setCurrentModelId(value);
    }, []);

    const handleInstallCurrentModel = useCallback(async () => {
        const modelId = currentModelId;
        setModelItems(prev => ({
            ...prev,
            [modelId]: {
                ...prev[modelId],
                busy: true,
                errorText: '',
                statusText: '准备安装',
            },
        }));
        try {
            await ensureModelReady(modelId, {
                baseUrl: MODEL_BASE_URL,
                onProgress: progress => {
                    setModelItems(prev => ({
                        ...prev,
                        [modelId]: {
                            ...prev[modelId],
                            statusText: phaseToText(progress),
                        },
                    }));
                },
            });
            await refreshModel(modelId);
        } catch (error) {
            setModelItems(prev => ({
                ...prev,
                [modelId]: {
                    ...prev[modelId],
                    busy: false,
                    errorText: `安装失败: ${(error as Error).message}`,
                    statusText: '安装失败',
                },
            }));
        }
    }, [currentModelId, refreshModel]);

    const handleImportCurrentModelZipForTesting = useCallback(async () => {
        const modelId = currentModelId;
        setModelItems(prev => ({
            ...prev,
            [modelId]: {
                ...prev[modelId],
                busy: true,
                errorText: '',
                statusText: '选择本地压缩包中',
            },
        }));
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
                multiple: false,
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets[0]?.uri) {
                setModelItems(prev => ({
                    ...prev,
                    [modelId]: {
                        ...prev[modelId],
                        busy: false,
                        statusText: '已取消导入',
                    },
                }));
                return;
            }

            setModelItems(prev => ({
                ...prev,
                [modelId]: {
                    ...prev[modelId],
                    statusText: '导入并解压中（测试接口）',
                },
            }));
            await importModelZipForTesting(modelId, result.assets[0].uri);
            await refreshModel(modelId);
        } catch (error) {
            setModelItems(prev => ({
                ...prev,
                [modelId]: {
                    ...prev[modelId],
                    busy: false,
                    errorText: `导入失败: ${(error as Error).message}`,
                    statusText: '导入失败',
                },
            }));
        }
    }, [currentModelId, refreshModel]);

    return (
        <DefaultLayout>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="p-4">
                <View className="mb-3 gap-2.5 rounded-lg border border-[#e5e7eb] p-3">
                    <TextX variant="subtitle">识别配置</TextX>
                    <View className="gap-2">
                        <TextX>当前识别模型</TextX>
                        <Tabs value={currentModelId} onValueChange={handleModelChange}>
                            <TabsList>
                                <TabsTrigger value="moonshine-zh" className="w-auto">
                                    moonshine-v2
                                </TabsTrigger>
                                <TabsTrigger value="paraformer-zh" className="w-auto">
                                    paraformer
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </View>
                    <View className="flex flex-row items-center justify-between">
                        <TextX>说话人分离开关：{speakerDiarizationEnabled ? '开启' : '关闭'}</TextX>
                        <SwitchX value={speakerDiarizationEnabled} onValueChange={handleToggleSpeakerDiarization} />
                    </View>
                    <View className="flex flex-row items-center justify-between">
                        <TextX>降噪开关：{denoiseEnabled ? '开启' : '关闭'}</TextX>
                        <SwitchX value={denoiseEnabled} onValueChange={handleToggleDenoise} />
                    </View>
                    <View className="gap-2">
                        <TextX>VAD 引擎</TextX>
                        <Tabs value={vadEngine} onValueChange={handleVadEngineChange}>
                            <TabsList>
                                <TabsTrigger value="tenvad" className="w-auto">
                                    tenvad
                                </TabsTrigger>
                                <TabsTrigger value="silerovad" className="w-auto">
                                    silerovad
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </View>
                    <View className="flex flex-row items-center justify-between">
                        <TextX>最终转写启用 VAD：{finalTranscribeUseVad ? '开启' : '关闭'}</TextX>
                        <SwitchX value={finalTranscribeUseVad} onValueChange={handleToggleFinalTranscribeUseVad} />
                    </View>
                    <View className="flex flex-row items-center justify-between">
                        <TextX>最终转写启用说话人分离：{finalTranscribeUseSpeakerDiarization ? '开启' : '关闭'}</TextX>
                        <SwitchX
                            value={finalTranscribeUseSpeakerDiarization}
                            onValueChange={handleToggleFinalTranscribeUseSpeakerDiarization}
                        />
                    </View>
                </View>

                <ScrollView
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
                    contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                    <View className="gap-1.5 rounded-lg border border-[#e5e7eb] p-3">
                        <View className="flex flex-row items-center justify-between gap-x-2">
                            <TextX variant="title">{currentModelId}</TextX>
                            <TextX variant="description">{modelItem.statusText || '-'}</TextX>
                        </View>

                        <View className="flex flex-row items-center gap-x-2">
                            <ButtonX onPress={handleInstallCurrentModel} loading={modelItem.busy}>
                                {modelItem.installed ? '重新安装' : '安装'}
                            </ButtonX>
                            <ButtonX variant="secondary" onPress={handleImportCurrentModelZipForTesting} loading={modelItem.busy}>
                                导入本地 {currentModelId} zip（测试）
                            </ButtonX>
                        </View>

                        <TextX variant="description">版本：{modelItem.version ?? '-'}</TextX>
                        {modelItem.errorText ? <TextX lightColor="#dc2626">{modelItem.errorText}</TextX> : null}
                    </View>
                </ScrollView>
            </View>
        </DefaultLayout>
    );
}
