import { AudioModule } from 'expo-audio';
import { Stack } from 'expo-router';

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';

import { Button } from '~/components/ui/button';
import { TextX } from '~/components/ui/text';
import { useFilePicker } from '~/hooks/useFilePicker';
import SherpaOnnx, {
    ensureModelReady,
    listLocalModels,
    type SherpaRealtimeResultEvent,
    type SherpaRealtimeStateEvent,
} from '~/modules/sherpa';

export default function Home() {
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState('未开始下载');
    const [modelsListText, setModelsListText] = useState('');
    const [conversionText, setConversionText] = useState('');
    const [realtimeState, setRealtimeState] = useState('stopped');
    const [permissionStatusText, setPermissionStatusText] = useState('未知');
    const [realtimePartialText, setRealtimePartialText] = useState('');
    const [realtimeFinalText, setRealtimeFinalText] = useState('');
    const [isRecordingByButton, setIsRecordingByButton] = useState(false);
    const [recordingActionLoading, setRecordingActionLoading] = useState(false);
    const [recordingStatusText, setRecordingStatusText] = useState('未开始录音');

    const fileModelId = 'paraformer-trilingual-zh-cantonese-en' as const;
    const realtimeModelId = 'streaming-paraformer-bilingual-zh-en' as const;
    const MODEL_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models/';

    const getModels = async () => {
        const res = await listLocalModels();
        setModelsListText(JSON.stringify(res));
    };

    const { pickDocument } = useFilePicker({
        multiple: true,
        onFilesSelected: selected => handleConversion(selected[0]?.uri),
        onError: error => console.error('Error:', error),
    });

    const handleDownloadModel = async () => {
        setDownloading(true);
        try {
            const localDir = await ensureModelReady(realtimeModelId, {
                baseUrl: MODEL_BASE_URL,
                onProgress: progress => {
                    if (progress.phase === 'downloading-zip') {
                        const percent = progress.percent ? `${Math.round(progress.percent * 100)}%` : '';
                        setDownloadStatus(`下载中 ${percent}`.trim());
                    } else if (progress.phase === 'verifying') {
                        setDownloadStatus('校验中');
                    } else if (progress.phase === 'extracting') {
                        setDownloadStatus('解压中');
                    } else if (progress.phase === 'ready') {
                        setDownloadStatus('模型就绪');
                    } else {
                        setDownloadStatus('获取模型信息');
                    }
                },
            });
            console.info('@log model downloaded', realtimeModelId, localDir);
        } finally {
            setDownloading(false);
        }
    };

    const handleConversion = async (uri: string) => {
        if (uri) {
            await ensureModelReady(fileModelId, { baseUrl: MODEL_BASE_URL });
            const r1 = await SherpaOnnx.transcribeWavByDownloadedModel(uri, fileModelId);
            setConversionText(r1.text);
        }
    };

    const toggleRecordAndTranscribe = async () => {
        if (recordingActionLoading) {
            return;
        }

        setRecordingActionLoading(true);
        try {
            if (!isRecordingByButton) {
                const permission = await AudioModule.requestRecordingPermissionsAsync();
                if (!permission.granted) {
                    setRecordingStatusText('录音权限未授予');
                    return;
                }

                await SherpaOnnx.startWavRecording({ sampleRate: 16000 });
                setIsRecordingByButton(true);
                setRecordingStatusText('录音中，再次点击停止并识别');
                return;
            }

            const wavResult = await SherpaOnnx.stopWavRecording();
            setIsRecordingByButton(false);

            if (!wavResult.path) {
                setRecordingStatusText('停止录音失败，未拿到音频文件');
                return;
            }

            setRecordingStatusText('录音完成，识别中...');
            await handleConversion(wavResult.path);
            setRecordingStatusText('识别完成');
        } catch (error) {
            setIsRecordingByButton(false);
            setRecordingStatusText(`录音/识别失败: ${(error as Error).message}`);
        } finally {
            setRecordingActionLoading(false);
        }
    };

    const startRealtime = async () => {
        await ensureModelReady(realtimeModelId, { baseUrl: MODEL_BASE_URL });
        setRealtimePartialText('');
        setRealtimeFinalText('');
        await SherpaOnnx.startRealtimeTranscriptionByDownloadedModel(realtimeModelId, {
            sampleRate: 16000,
            emitIntervalMs: 150,
            enableEndpoint: false,
        });
    };

    const requestRecordingPermissionOnly = async () => {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        setPermissionStatusText(permission.granted ? '已授予' : '未授予');
    };

    const stopRealtime = async () => {
        await SherpaOnnx.stopRealtimeTranscription();
    };

    useEffect(() => {
        const resultSub = SherpaOnnx.addRealtimeResultListener((event: SherpaRealtimeResultEvent) => {
            if (event.type === 'partial') {
                setRealtimePartialText(event.text ?? '');
            } else if (event.type === 'final') {
                const text = event.text ?? '';
                if (text) {
                    setRealtimeFinalText(prev => (prev ? `${prev}\n${text}` : text));
                }
                setRealtimePartialText('');
            } else if (event.type === 'error') {
                setRealtimePartialText(`识别错误: ${event.message ?? 'unknown'}`);
            }
        });

        const stateSub = SherpaOnnx.addRealtimeStateListener((event: SherpaRealtimeStateEvent) => {
            setRealtimeState(event.state);
        });

        return () => {
            resultSub.remove();
            stateSub.remove();
        };
    }, []);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ gap: 12 }}>
                <Button onPress={requestRecordingPermissionOnly}>获取录音权限</Button>
                <TextX>录音权限：{permissionStatusText}</TextX>
                <Button loading={downloading} onPress={handleDownloadModel}>
                    下载模型
                </Button>
                <TextX>模型状态：{downloadStatus}</TextX>
                <Button onPress={getModels}>获取模型列表</Button>
                <TextX>模型列表：{modelsListText}</TextX>
                <Button onPress={pickDocument}>选择文件</Button>
                <Button loading={recordingActionLoading} onPress={toggleRecordAndTranscribe}>
                    {isRecordingByButton ? '停止录音并识别' : '开始录音'}
                </Button>
                <TextX>录音状态：{recordingStatusText}</TextX>
                <TextX>离线翻译结果：{conversionText}</TextX>
                <Button onPress={startRealtime} disabled={realtimeState === 'running' || realtimeState === 'starting'}>
                    开始实时识别
                </Button>
                <Button onPress={stopRealtime} disabled={realtimeState !== 'running'}>
                    停止实时识别
                </Button>
                <TextX>实时状态: {realtimeState}</TextX>
                <TextX>实时中间结果: {realtimePartialText}</TextX>
                <TextX>实时最终结果: {realtimeFinalText}</TextX>
            </View>
        </DefaultLayout>
    );
}
