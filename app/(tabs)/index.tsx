import { useFocusEffect } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';
import { Button } from '~/components/ui/button';
import { TextX } from '~/components/ui/text';
import { useFilePicker } from '~/hooks/useFilePicker';
import SherpaOnnx, { getInstalledModelVersion } from '~/modules/sherpa';
import { MIN_MODEL_VERSION_BY_MODEL_ID } from '~/scripts/const';
import { getDenoiseEnabled, getSpeakerDiarizationEnabled } from '~/utils/app-config';
import { getCurrentModel } from '~/utils/model-selection';
import { runRecognitionPreflight as runRecognitionPreflightTool } from '~/utils/tools';

const DEFAULT_SPEAKER_SEGMENTATION_MODEL = 'sherpa/onnx/speaker-diarization.onnx';
const DEFAULT_SPEAKER_EMBEDDING_MODEL = 'sherpa/onnx/speaker-recognition.onnx';

type VadSegmentItem = {
    index: number;
    path: string;
    text: string;
    numSamples: number;
    durationMs: number;
};

type SegmentRecognitionState = {
    loading: boolean;
    text: string;
    error: string;
};

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
    const [conversionElapsedMs, setConversionElapsedMs] = useState<number | null>(null);
    const [fileRecognitionStatusText, setFileRecognitionStatusText] = useState('待选择文件');
    const [speakerDiarizationEnabled, setSpeakerDiarizationEnabled] = useState(getSpeakerDiarizationEnabled());
    const [denoiseEnabled, setDenoiseEnabled] = useState(getDenoiseEnabled());
    const [isRecordingByButton, setIsRecordingByButton] = useState(false);
    const [recordingActionLoading, setRecordingActionLoading] = useState(false);
    const [recordingStatusText, setRecordingStatusText] = useState('未开始录音');
    const [vadSegments, setVadSegments] = useState<VadSegmentItem[]>([]);
    const [segmentRecognitionMap, setSegmentRecognitionMap] = useState<Record<string, SegmentRecognitionState>>({});
    const [playingVadPath, setPlayingVadPath] = useState<string | null>(null);
    const vadPlayer = useAudioPlayer(null, { updateInterval: 200 });
    const vadPlayerStatus = useAudioPlayerStatus(vadPlayer);

    const checkCurrentModelVersions = useCallback(async () => {
        const currentModelId = getCurrentModel();
        const minimumVersion = MIN_MODEL_VERSION_BY_MODEL_ID[currentModelId];
        if (!minimumVersion) {
            return;
        }
        const installedVersion = await getInstalledModelVersion(currentModelId);
        if (!installedVersion) {
            return;
        }
        if (compareModelVersion(installedVersion, minimumVersion) < 0) {
            console.warn(
                `[model-version-check] current model(${currentModelId}) version(${installedVersion}) is lower than minimum required(${minimumVersion})`,
            );
        }
    }, []);

    const { pickDocument } = useFilePicker({
        multiple: false,
        onError: error => console.error('Error:', error),
    });

    const runRecognitionPreflight = useCallback(async (kind: 'file' | 'recording'): Promise<boolean> => {
        const modelId = getCurrentModel();
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
        setConversionElapsedMs(null);
        try {
            const currentModelId = getCurrentModel();
            const startedAt = Date.now();
            const result = await SherpaOnnx.transcribeWavByDownloadedModel(uri, currentModelId, {
                enableDenoise: denoiseEnabled,
                enableSpeakerDiarization: speakerDiarizationEnabled,
                speakerSegmentationModel: DEFAULT_SPEAKER_SEGMENTATION_MODEL,
                speakerEmbeddingModel: DEFAULT_SPEAKER_EMBEDDING_MODEL,
            });
            const normalizedSegments = (result.vadSegments ?? []).filter(item => Boolean(item.path));
            setConversionElapsedMs(Date.now() - startedAt);
            setVadSegments(normalizedSegments);
            setSegmentRecognitionMap({});
            setPlayingVadPath(null);
            vadPlayer.pause();

            if (normalizedSegments.length > 0) {
                const recognizedTexts: string[] = [];
                for (let index = 0; index < normalizedSegments.length; index += 1) {
                    const segment = normalizedSegments[index];
                    setFileRecognitionStatusText(`VAD 分段识别中 (${index + 1}/${normalizedSegments.length})...`);
                    const segmentResult = await SherpaOnnx.transcribeWavByDownloadedModel(segment.path, currentModelId, {
                        enableDenoise: false,
                        enableVad: false,
                        enableSpeakerDiarization: false,
                    });
                    const text = segmentResult.text.trim();
                    if (text) {
                        recognizedTexts.push(text);
                    }
                }
                setConversionText(recognizedTexts.join('\n'));
            } else {
                setConversionText(result.text);
            }

            setFileRecognitionStatusText('文件识别完成');
            return true;
        } catch (error) {
            const message = (error as Error).message ?? 'unknown';
            setConversionElapsedMs(null);
            setVadSegments([]);
            setSegmentRecognitionMap({});
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

    const togglePlayVadSegment = useCallback(
        (path: string) => {
            try {
                if (playingVadPath === path) {
                    if (vadPlayerStatus.playing) {
                        vadPlayer.pause();
                    } else {
                        vadPlayer.play();
                    }
                    return;
                }

                vadPlayer.replace(path);
                vadPlayer.play();
                setPlayingVadPath(path);
            } catch (error) {
                setFileRecognitionStatusText(`播放失败: ${(error as Error).message}`);
            }
        },
        [playingVadPath, vadPlayer, vadPlayerStatus.playing],
    );

    const handleRecognizeVadSegment = useCallback(
        async (segmentPath: string) => {
            setSegmentRecognitionMap(prev => ({
                ...prev,
                [segmentPath]: {
                    loading: true,
                    text: prev[segmentPath]?.text ?? '',
                    error: '',
                },
            }));
            try {
                const canContinue = await runRecognitionPreflight('file');
                if (!canContinue) {
                    setSegmentRecognitionMap(prev => ({
                        ...prev,
                        [segmentPath]: {
                            loading: false,
                            text: prev[segmentPath]?.text ?? '',
                            error: '识别前置检查未通过',
                        },
                    }));
                    return;
                }

                const modelId = getCurrentModel();
                const result = await SherpaOnnx.transcribeWavByDownloadedModel(segmentPath, modelId, {
                    enableDenoise: denoiseEnabled,
                    enableVad: false,
                    enableSpeakerDiarization: false,
                });
                setSegmentRecognitionMap(prev => ({
                    ...prev,
                    [segmentPath]: {
                        loading: false,
                        text: result.text,
                        error: '',
                    },
                }));
            } catch (error) {
                setSegmentRecognitionMap(prev => ({
                    ...prev,
                    [segmentPath]: {
                        loading: false,
                        text: prev[segmentPath]?.text ?? '',
                        error: (error as Error).message ?? 'unknown',
                    },
                }));
            }
        },
        [denoiseEnabled, runRecognitionPreflight],
    );

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

    useFocusEffect(
        useCallback(() => {
            checkCurrentModelVersions().catch(error => {
                console.error('[model-version-check] failed', error);
            });
            setSpeakerDiarizationEnabled(getSpeakerDiarizationEnabled());
            setDenoiseEnabled(getDenoiseEnabled());
        }, [checkCurrentModelVersions]),
    );

    useEffect(() => {
        if (vadPlayerStatus.didJustFinish && !vadPlayerStatus.playing) {
            setPlayingVadPath(null);
        }
    }, [vadPlayerStatus.didJustFinish, vadPlayerStatus.playing]);

    useEffect(() => {
        return () => {
            vadPlayer.pause();
        };
    }, [vadPlayer]);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-6">
                <Button onPress={handlePickDocument}>选择文件</Button>
                <Button loading={recordingActionLoading} onPress={toggleRecordAndTranscribe}>
                    {isRecordingByButton ? '停止录音并识别' : '开始录音'}
                </Button>
                <TextX>录音状态：{recordingStatusText}</TextX>
                <TextX>文件识别状态：{fileRecognitionStatusText}</TextX>
                <TextX>离线翻译结果：{conversionText}</TextX>
                {conversionElapsedMs === null ? null : <TextX>耗时：{(conversionElapsedMs / 1000).toFixed(2)} s</TextX>}

                <View className="gap-2">
                    <TextX variant="description">
                        VAD 分段结果：{vadSegments.length > 0 ? `共 ${vadSegments.length} 段` : '暂无（请先完成一次识别）'}
                    </TextX>
                    {vadSegments.map(item => {
                        const segmentState = segmentRecognitionMap[item.path];
                        const displayText = segmentState?.text || item.text;
                        return (
                            <View key={item.path} className="border-border rounded-xl border px-3 py-2">
                                <TextX>段 {item.index}</TextX>
                                <TextX numberOfLines={1} variant="description">
                                    {item.path}
                                </TextX>
                                <TextX variant="description">时长: {(item.durationMs / 1000).toFixed(2)} s</TextX>
                                <TextX numberOfLines={2} variant="description">
                                    文本: {displayText || '(空)'}
                                </TextX>
                                {segmentState?.error ? <TextX variant="description">识别失败: {segmentState.error}</TextX> : null}
                                <View className="mt-2 flex-row items-center gap-2">
                                    <Button size="sm" variant="outline" onPress={() => togglePlayVadSegment(item.path)}>
                                        {playingVadPath === item.path && vadPlayerStatus.playing ? '暂停' : '播放'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        loading={segmentState?.loading ?? false}
                                        onPress={() => handleRecognizeVadSegment(item.path)}>
                                        识别该段
                                    </Button>
                                    <TextX variant="description">
                                        {playingVadPath === item.path ? (vadPlayerStatus.playing ? '播放中' : '已暂停') : ''}
                                    </TextX>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </DefaultLayout>
    );
}
