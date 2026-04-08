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
    getSpeakerDiarizationEnabled,
    getVadEngine,
    setDenoiseEnabled,
    setSpeakerDiarizationEnabled,
    setVadEngine,
    type VadEngineId,
} from '~/data/mmkv/app-config';
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
const QWEN3_MODEL_ID: SherpaModelId = 'qwen3';

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
    const [modelItem, setModelItem] = useState<ModelItemState>({
        installed: false,
        version: null,
        busy: false,
        statusText: '',
        errorText: '',
    });

    const refreshModel = useCallback(async () => {
        const installed = await isModelDownloaded(QWEN3_MODEL_ID);
        const installedVersion = installed ? await getInstalledModelVersion(QWEN3_MODEL_ID) : null;
        const version = installedVersion ?? MIN_MODEL_VERSION_BY_MODEL_ID[QWEN3_MODEL_ID] ?? null;
        setModelItem({
            installed,
            version,
            busy: false,
            statusText: installed ? '已安装' : '未安装',
            errorText: '',
        });
    }, []);

    const refreshAll = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshModel();
            setVadEngineState(getVadEngine());
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

    const handleInstallQwen3 = useCallback(async () => {
        setModelItem(prev => ({
            ...prev,
            busy: true,
            errorText: '',
            statusText: '准备安装',
        }));
        try {
            await ensureModelReady(QWEN3_MODEL_ID, {
                baseUrl: MODEL_BASE_URL,
                onProgress: progress => {
                    setModelItem(prev => ({
                        ...prev,
                        statusText: phaseToText(progress),
                    }));
                },
            });
            await refreshModel();
        } catch (error) {
            setModelItem(prev => ({
                ...prev,
                busy: false,
                errorText: `安装失败: ${(error as Error).message}`,
                statusText: '安装失败',
            }));
        }
    }, [refreshModel]);

    const handleImportQwen3ZipForTesting = useCallback(async () => {
        setModelItem(prev => ({
            ...prev,
            busy: true,
            errorText: '',
            statusText: '选择本地压缩包中',
        }));
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
                multiple: false,
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets[0]?.uri) {
                setModelItem(prev => ({ ...prev, busy: false, statusText: '已取消导入' }));
                return;
            }

            setModelItem(prev => ({ ...prev, statusText: '导入并解压中（测试接口）' }));
            await importModelZipForTesting(QWEN3_MODEL_ID, result.assets[0].uri);
            await refreshModel();
        } catch (error) {
            setModelItem(prev => ({
                ...prev,
                busy: false,
                errorText: `导入失败: ${(error as Error).message}`,
                statusText: '导入失败',
            }));
        }
    }, [refreshModel]);

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
                </View>

                <ScrollView
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} />}
                    contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                    <View className="gap-1.5 rounded-lg border border-[#e5e7eb] p-3">
                        <View className="flex flex-row items-center justify-between gap-x-2">
                            <TextX variant="title">qwen3</TextX>
                            <TextX variant="description">{modelItem.statusText || '-'}</TextX>
                        </View>

                        <View className="flex flex-row items-center gap-x-2">
                            <ButtonX onPress={handleInstallQwen3} loading={modelItem.busy}>
                                {modelItem.installed ? '重新安装' : '安装'}
                            </ButtonX>
                            <ButtonX variant="secondary" onPress={handleImportQwen3ZipForTesting} loading={modelItem.busy}>
                                导入本地 qwen3 zip（测试）
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
