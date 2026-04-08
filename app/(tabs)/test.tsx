import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { getDenoiseEnabled, getSpeakerDiarizationEnabled, getVadEngine } from '~/data/mmkv/app-config';
import { getCurrentModel } from '~/data/mmkv/model-selection';
import { useFilePicker } from '~/hooks/useFilePicker';
import SherpaOnnx, { getInstalledModelVersion } from '~/modules/sherpa';
import { MIN_MODEL_VERSION_BY_MODEL_ID } from '~/scripts/const';
import { runRecognitionPreflight as runRecognitionPreflightTool } from '~/scripts/utils';
import { pickRandomNewsSample } from '~/features/test/data/news-samples';
import { summarizeTextByRemoteApi, type RemoteSummaryProgress } from '~/integrations/llm/remote-summary';

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

type FileRecognitionTiming = {
    mainDecodeMs: number;
    segmentDecodeTotalMs: number;
    segmentCount: number;
    segmentDecodeDetails: {
        index: number;
        durationMs: number;
        path: string;
    }[];
    textAssembleMs: number;
    totalMs: number;
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
    const [fileRecognitionTiming, setFileRecognitionTiming] = useState<FileRecognitionTiming | null>(null);
    const [fileRecognitionStatusText, setFileRecognitionStatusText] = useState('待选择文件');
    const [speakerDiarizationEnabled, setSpeakerDiarizationEnabled] = useState(getSpeakerDiarizationEnabled());
    const [denoiseEnabled, setDenoiseEnabled] = useState(getDenoiseEnabled());
    const [vadSegments, setVadSegments] = useState<VadSegmentItem[]>([]);
    const [segmentRecognitionMap, setSegmentRecognitionMap] = useState<Record<string, SegmentRecognitionState>>({});
    const [playingVadPath, setPlayingVadPath] = useState<string | null>(null);
    const [qwenStatusText, setQwenStatusText] = useState('待选择新闻样本');
    const [selectedNews, setSelectedNews] = useState(() => pickRandomNewsSample());
    const [qwenSummaryText, setQwenSummaryText] = useState('');
    const [qwenProgress, setQwenProgress] = useState<RemoteSummaryProgress | null>(null);
    const [qwenElapsedMs, setQwenElapsedMs] = useState<number | null>(null);
    const [qwenRemoteModel, setQwenRemoteModel] = useState<string | null>(null);
    const vadPlayer = useAudioPlayer(null, { updateInterval: 200 });
    const vadPlayerStatus = useAudioPlayerStatus(vadPlayer);
    const pauseVadPlayer = useCallback(async () => {
        try {
            await vadPlayer.pause();
        } catch (error) {
            // During refresh/unmount, native player can be in an invalid state.
            console.warn('[vad-player] pause skipped:', (error as Error)?.message ?? error);
        }
    }, [vadPlayer]);

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
        setFileRecognitionTiming(null);
        try {
            const currentModelId = getCurrentModel();
            const totalStartedAt = Date.now();
            const mainDecodeStartedAt = Date.now();
            const result = await SherpaOnnx.transcribeWavByDownloadedModel(uri, currentModelId, {
                enableDenoise: denoiseEnabled,
                enableSpeakerDiarization: speakerDiarizationEnabled,
                speakerSegmentationModel: DEFAULT_SPEAKER_SEGMENTATION_MODEL,
                speakerEmbeddingModel: DEFAULT_SPEAKER_EMBEDDING_MODEL,
                vadMaxSpeechDuration: 60,
                vadEngine: getVadEngine(),
            });
            const mainDecodeMs = Date.now() - mainDecodeStartedAt;
            const normalizedSegments = (result.vadSegments ?? []).filter(item => Boolean(item.path));
            setVadSegments(normalizedSegments);
            setSegmentRecognitionMap({});
            setPlayingVadPath(null);
            void pauseVadPlayer();

            let segmentDecodeTotalMs = 0;
            const segmentDecodeDetails: FileRecognitionTiming['segmentDecodeDetails'] = [];
            const textAssembleStartedAt = Date.now();
            // Avoid decoding every VAD segment again by default.
            // The main decode already returns final text; per-segment decode remains available via "识别该段" button.
            setConversionText(result.text);
            const textAssembleMs = Date.now() - textAssembleStartedAt;
            const totalMs = Date.now() - totalStartedAt;
            setConversionElapsedMs(totalMs);
            setFileRecognitionTiming({
                mainDecodeMs,
                segmentDecodeTotalMs,
                segmentCount: normalizedSegments.length,
                segmentDecodeDetails,
                textAssembleMs,
                totalMs,
            });

            setFileRecognitionStatusText('文件识别完成');
            return true;
        } catch (error) {
            const message = (error as Error).message ?? 'unknown';
            setConversionElapsedMs(null);
            setFileRecognitionTiming(null);
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
                        void pauseVadPlayer();
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
        [pauseVadPlayer, playingVadPath, vadPlayer, vadPlayerStatus.playing],
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
                    vadEngine: getVadEngine(),
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

    const handleRandomNews = useCallback(() => {
        setSelectedNews(pickRandomNewsSample());
        setQwenSummaryText('');
        setQwenElapsedMs(null);
        setQwenStatusText('已随机抽取一条新闻样本');
    }, []);

    const handleSummarizeNews = useCallback(async () => {
        setQwenSummaryText('');
        setQwenElapsedMs(null);
        setQwenRemoteModel(null);
        setQwenProgress(null);
        try {
            const result = await summarizeTextByRemoteApi({
                input: selectedNews.content,
                onProgress: progress => {
                    setQwenProgress(progress);
                    setQwenStatusText(progress.message);
                },
            });
            setQwenSummaryText(result.summaryText);
            setQwenElapsedMs(result.elapsedMs);
            setQwenRemoteModel(result.model);
            setQwenStatusText('远程推理完成');
        } catch (error) {
            const message = (error as Error).message ?? 'unknown';
            setQwenStatusText(`推理失败：${message}`);
        }
    }, [selectedNews.content]);

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
            void pauseVadPlayer();
        };
    }, [pauseVadPlayer]);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-6">
                <ButtonX onPress={handlePickDocument}>选择文件</ButtonX>
                <TextX>文件识别状态：{fileRecognitionStatusText}</TextX>
                <TextX>离线翻译结果：{conversionText}</TextX>
                {conversionElapsedMs === null ? null : <TextX>耗时：{(conversionElapsedMs / 1000).toFixed(2)} s</TextX>}
                {fileRecognitionTiming ? (
                    <View className="gap-1 rounded-lg border border-[#e5e7eb] p-3">
                        <TextX variant="subtitle">识别分阶段耗时</TextX>
                        <TextX variant="description">总耗时：{(fileRecognitionTiming.totalMs / 1000).toFixed(2)} s</TextX>
                        <TextX variant="description">主识别（含VAD输出）：{(fileRecognitionTiming.mainDecodeMs / 1000).toFixed(2)} s</TextX>
                        <TextX variant="description">
                            分段识别总耗时：{(fileRecognitionTiming.segmentDecodeTotalMs / 1000).toFixed(2)} s
                        </TextX>
                        <TextX variant="description">分段数量：{fileRecognitionTiming.segmentCount}</TextX>
                        <TextX variant="description">文本拼接与收尾：{(fileRecognitionTiming.textAssembleMs / 1000).toFixed(2)} s</TextX>
                        {fileRecognitionTiming.segmentDecodeDetails.length > 0 ? (
                            <View className="mt-1 gap-0.5">
                                {fileRecognitionTiming.segmentDecodeDetails.map(detail => (
                                    <TextX key={detail.path} variant="description">
                                        段 {detail.index}：{(detail.durationMs / 1000).toFixed(2)} s
                                    </TextX>
                                ))}
                            </View>
                        ) : null}
                    </View>
                ) : null}

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
                                    <ButtonX size="sm" variant="outline" onPress={() => togglePlayVadSegment(item.path)}>
                                        {playingVadPath === item.path && vadPlayerStatus.playing ? '暂停' : '播放'}
                                    </ButtonX>
                                    <ButtonX
                                        size="sm"
                                        variant="outline"
                                        loading={segmentState?.loading ?? false}
                                        onPress={() => handleRecognizeVadSegment(item.path)}>
                                        识别该段
                                    </ButtonX>
                                    <TextX variant="description">
                                        {playingVadPath === item.path ? (vadPlayerStatus.playing ? '播放中' : '已暂停') : ''}
                                    </TextX>
                                </View>
                            </View>
                        );
                    })}
                </View>

                <View className="gap-2 rounded-xl border border-[#e5e7eb] p-3">
                    <TextX variant="title">远程 LLM 摘要（测试页）</TextX>
                    <TextX variant="description">状态：{qwenStatusText}</TextX>
                    <TextX variant="description">样本：{selectedNews.title}</TextX>
                    <TextX numberOfLines={6} variant="description">
                        {selectedNews.content}
                    </TextX>
                    <View className="flex-row items-center gap-2">
                        <ButtonX size="sm" variant="outline" onPress={handleRandomNews}>
                            随机新闻
                        </ButtonX>
                        <ButtonX size="sm" onPress={handleSummarizeNews} loading={qwenProgress?.stage === 'requesting'}>
                            随机新闻总结
                        </ButtonX>
                    </View>

                    {qwenProgress ? (
                        <View className="gap-1">
                            <TextX variant="description">阶段进度：{Math.round(qwenProgress.stageProgress * 100)}%</TextX>
                            <TextX variant="description">阶段：{qwenProgress.stage}</TextX>
                        </View>
                    ) : null}

                    {qwenSummaryText ? (
                        <View className="gap-1 rounded-lg border border-[#e5e7eb] p-2">
                            <TextX variant="subtitle">总结结果</TextX>
                            <TextX>{qwenSummaryText}</TextX>
                        </View>
                    ) : null}

                    <View className="gap-1">
                        <TextX variant="description">远程模型：{qwenRemoteModel ?? '-'}</TextX>
                        <TextX variant="description">远程耗时(ms)：{qwenElapsedMs ?? '-'}</TextX>
                        <TextX variant="description">提示：请配置 `EXPO_PUBLIC_LLM_API_KEY` 后再使用</TextX>
                    </View>
                </View>
            </ScrollView>
        </DefaultLayout>
    );
}
