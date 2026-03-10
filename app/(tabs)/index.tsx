import { useFocusEffect } from '@react-navigation/native';
import { Stack } from 'expo-router';

import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';

import { Button } from '~/components/ui/button';
import { SwitchX } from '~/components/ui/switch';
import { TextX } from '~/components/ui/text';
import { useFilePicker } from '~/hooks/useFilePicker';
import SherpaOnnx, {
    getInstalledModelVersion,
    SHERPA_MODEL_PRESETS,
    type SherpaModelId,
    type SherpaOutputMode,
    type SherpaRealtimeResultEvent,
    type SherpaRealtimeStateEvent,
} from '~/modules/sherpa';
import { MIN_MODEL_VERSION_BY_MODEL_ID } from '~/scripts/const';
import { getCurrentModelByOutputMode } from '~/utils/model-selection';
import { runRecognitionPreflight as runRecognitionPreflightTool } from '~/utils/tools';

const DEFAULT_NON_STREAMING_MODEL: SherpaModelId = 'zipformer-ctc-zh';
const DEFAULT_STREAMING_MODEL: SherpaModelId = 'zipformer-zh-streaming';
const DEFAULT_SPEAKER_SEGMENTATION_MODEL = 'sherpa/segmentation/pyannote-segmentation.onnx';
const DEFAULT_SPEAKER_EMBEDDING_MODEL = 'sherpa/speaker-embedding/3dspeaker_campplus_sv_zh-cn.onnx';

function resolveSelectedModel(outputMode: SherpaOutputMode, fallback: SherpaModelId): SherpaModelId {
    const selected = getCurrentModelByOutputMode(outputMode);
    if (!selected || !(selected in SHERPA_MODEL_PRESETS)) {
        return fallback;
    }
    if (SHERPA_MODEL_PRESETS[selected].outputMode !== outputMode) {
        return fallback;
    }
    return selected;
}

function compareModelVersion(left: string, right: string): number {
    const leftParts = left.split('.').map(part => Number.parseInt(part, 10));
    const rightParts = right.split('.').map(part => Number.parseInt(part, 10));
    const hasNaN = [...leftParts, ...rightParts].some(Number.isNaN);
    if (hasNaN) {
        return left.localeCompare(right);
    }
    const maxLen = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < maxLen; index += 1) {
        const leftValue = leftParts[index] ?? 0;
        const rightValue = rightParts[index] ?? 0;
        if (leftValue !== rightValue) {
            return leftValue - rightValue;
        }
    }
    return 0;
}

export default function Home() {
    const [conversionText, setConversionText] = useState('');
    const [fileRecognitionStatusText, setFileRecognitionStatusText] = useState('待选择文件');
    const [realtimeState, setRealtimeState] = useState('stopped');
    const [realtimePartialText, setRealtimePartialText] = useState('');
    const [realtimeFinalText, setRealtimeFinalText] = useState('');
    const [realtimeVadInfo, setRealtimeVadInfo] = useState('unknown');
    const [vadEnabled, setVadEnabled] = useState(true);
    const [speakerDiarizationEnabled, setSpeakerDiarizationEnabled] = useState(false);
    const [isRecordingByButton, setIsRecordingByButton] = useState(false);
    const [recordingActionLoading, setRecordingActionLoading] = useState(false);
    const [recordingStatusText, setRecordingStatusText] = useState('未开始录音');

    const checkCurrentModelVersions = useCallback(async () => {
        const currentModels: { outputMode: SherpaOutputMode; modelId: SherpaModelId }[] = [
            { outputMode: 'nonStreaming', modelId: resolveSelectedModel('nonStreaming', DEFAULT_NON_STREAMING_MODEL) },
            { outputMode: 'streaming', modelId: resolveSelectedModel('streaming', DEFAULT_STREAMING_MODEL) },
        ];

        for (const item of currentModels) {
            const minimumVersion = MIN_MODEL_VERSION_BY_MODEL_ID[item.modelId];
            if (!minimumVersion) {
                continue;
            }
            const installedVersion = await getInstalledModelVersion(item.modelId);
            if (!installedVersion) {
                continue;
            }
            if (compareModelVersion(installedVersion, minimumVersion) < 0) {
                console.warn(
                    `[model-version-check] ${item.outputMode} current model(${item.modelId}) version(${installedVersion}) is lower than minimum required(${minimumVersion})`,
                );
            }
        }
    }, []);

    const { pickDocument } = useFilePicker({
        multiple: false,
        onError: error => console.error('Error:', error),
    });

    const runRecognitionPreflight = useCallback(async (kind: 'file' | 'recording' | 'realtime'): Promise<boolean> => {
        const modelId = kind === 'realtime' ? getCurrentModelByOutputMode('streaming') : getCurrentModelByOutputMode('nonStreaming');
        return runRecognitionPreflightTool({
            kind,
            modelId,
        });
    }, []);

    const handleConversion = async (uri?: string): Promise<boolean> => {
        if (!uri) {
            setFileRecognitionStatusText('未获取到文件路径');
            return false;
        }

        setFileRecognitionStatusText('文件识别中...');
        try {
            const currentModelId = getCurrentModelByOutputMode('nonStreaming');
            const r1 = await SherpaOnnx.transcribeWavByDownloadedModel(uri, currentModelId, {
                enableSpeakerDiarization: speakerDiarizationEnabled,
                speakerSegmentationModel: DEFAULT_SPEAKER_SEGMENTATION_MODEL,
                speakerEmbeddingModel: DEFAULT_SPEAKER_EMBEDDING_MODEL,
            });
            setConversionText(r1.text);
            setFileRecognitionStatusText('文件识别完成');
            return true;
        } catch (error) {
            const message = (error as Error).message ?? 'unknown';
            setFileRecognitionStatusText(`文件识别失败: ${message}`);
            console.error('[file-recognition] failed', error);
            return false;
        }
    };

    const handlePickDocument = useCallback(async () => {
        const canContinue = await runRecognitionPreflight('file');
        if (!canContinue) {
            return;
        }
        const selected = await pickDocument({ multiple: false });
        await handleConversion(selected[0]?.uri);
    }, [pickDocument, runRecognitionPreflight, handleConversion]);

    const toggleRecordAndTranscribe = async () => {
        if (recordingActionLoading) {
            return;
        }

        setRecordingActionLoading(true);
        try {
            if (!isRecordingByButton) {
                const canContinue = await runRecognitionPreflight('recording');
                if (!canContinue) {
                    setRecordingStatusText('录音前置检查未通过');
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
        const canContinue = await runRecognitionPreflight('realtime');
        if (!canContinue) {
            setRealtimePartialText('识别错误: 权限未授予或模型未安装');
            return;
        }
        const currentModelId = getCurrentModelByOutputMode('streaming');
        setRealtimePartialText('');
        setRealtimeFinalText('');
        setRealtimeVadInfo('starting');
        await SherpaOnnx.startRealtimeTranscriptionByDownloadedModel(currentModelId, {
            sampleRate: 16000,
            emitIntervalMs: 150,
            enableEndpoint: false,
            enableVad: vadEnabled || speakerDiarizationEnabled,
            enableSpeakerDiarization: speakerDiarizationEnabled,
            speakerSegmentationModel: DEFAULT_SPEAKER_SEGMENTATION_MODEL,
            speakerEmbeddingModel: DEFAULT_SPEAKER_EMBEDDING_MODEL,
        });
    };

    const stopRealtime = async () => {
        await SherpaOnnx.stopRealtimeTranscription();
    };

    useFocusEffect(
        useCallback(() => {
            checkCurrentModelVersions().catch(error => {
                console.error('[model-version-check] failed', error);
            });
        }, [checkCurrentModelVersions]),
    );

    useEffect(() => {
        const resultSub = SherpaOnnx.addRealtimeResultListener((event: SherpaRealtimeResultEvent) => {
            if (event.type === 'partial') {
                setRealtimePartialText(event.text ?? '');
            } else if (event.type === 'final') {
                const text = event.text ?? '';
                if (text) {
                    setRealtimeFinalText(prev => (prev ? `${prev}${text}` : text));
                }
                setRealtimePartialText('');
            } else if (event.type === 'error') {
                setRealtimePartialText(`识别错误: ${event.message ?? 'unknown'}`);
            }
        });

        const stateSub = SherpaOnnx.addRealtimeStateListener((event: SherpaRealtimeStateEvent) => {
            setRealtimeState(event.state);
            const vadStatus = event.vadActive ? 'active' : 'inactive';
            const vadInfo = event.vadInfo ?? 'none';
            setRealtimeVadInfo(`${vadStatus} | ${vadInfo}`);
        });

        return () => {
            resultSub.remove();
            stateSub.remove();
        };
    }, []);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="gap-4 p-4">
                <Button onPress={handlePickDocument}>选择文件</Button>
                <Button loading={recordingActionLoading} onPress={toggleRecordAndTranscribe}>
                    {isRecordingByButton ? '停止录音并识别' : '开始录音'}
                </Button>
                <TextX>录音状态：{recordingStatusText}</TextX>
                <TextX>文件识别状态：{fileRecognitionStatusText}</TextX>
                <TextX>离线翻译结果：{conversionText}</TextX>
                <View className="flex flex-row items-center">
                    <TextX>VAD 开关：{vadEnabled ? '开启' : '关闭'}</TextX>
                    <SwitchX value={vadEnabled} onValueChange={setVadEnabled} />
                </View>
                <View className="flex flex-row items-center">
                    <TextX>说话人分离开关：{speakerDiarizationEnabled ? '开启' : '关闭'}</TextX>
                    <SwitchX value={speakerDiarizationEnabled} onValueChange={setSpeakerDiarizationEnabled} />
                </View>
                <Button onPress={startRealtime} disabled={realtimeState === 'running' || realtimeState === 'starting'}>
                    开始实时识别
                </Button>
                <Button onPress={stopRealtime} disabled={realtimeState !== 'running'}>
                    停止实时识别
                </Button>
                <TextX>实时状态: {realtimeState}</TextX>
                <TextX>VAD运行状态: {realtimeVadInfo}</TextX>
                <TextX>实时中间结果: {realtimePartialText}</TextX>
                <TextX>实时最终结果: {realtimeFinalText}</TextX>
            </View>
        </DefaultLayout>
    );
}
