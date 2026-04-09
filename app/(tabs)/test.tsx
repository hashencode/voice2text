import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { getDenoiseEnabled, getSpeakerDiarizationEnabled } from '~/data/mmkv/app-config';
import { getCurrentModel } from '~/data/mmkv/model-selection';
import { pickRandomNewsSample } from '~/features/test/data/news-samples';
import { useFilePicker } from '~/hooks/useFilePicker';
import { summarizeTextByRemoteApi, type RemoteSummaryProgress } from '~/integrations/llm/remote-summary';
import { transcribeFileWithTiming } from '~/integrations/sherpa/recognition-service';
import { getInstalledModelVersion } from '~/modules/sherpa';
import { MIN_MODEL_VERSION_BY_MODEL_ID } from '~/scripts/const';
import { runRecognitionPreflight as runRecognitionPreflightTool } from '~/scripts/utils';

type VadSegmentItem = {
    index: number;
    path: string;
    text: string;
    numSamples: number;
    durationMs: number;
};

type FileRecognitionTiming = {
    preflightMs: number;
    documentPickMs: number;
    conversionTotalMs: number;
    prepareRuntimePathsMs: number;
    nativeTranscribeMs: number;
    provider: string;
    numThreads: number;
    availableProcessors: number;
    performanceTier: 'low' | 'high';
    runtimePathPrepareSteps: {
        key: string;
        copied: boolean;
        skipped: boolean;
        skipReason?: string;
        elapsedMs: number;
    }[];
    mainDecodeMs: number;
    segmentCount: number;
    vadRawSegmentCount: number;
    vadNoPathSegmentCount: number;
    vadDurationTotalMs: number;
    textAssembleMs: number;
    totalMs: number;
};

const RUNTIME_PATH_STEP_LABEL: Record<string, string> = {
    denoiseModel: '降噪模型路径准备',
    punctuationModel: '标点模型路径准备',
    vadModel: 'VAD 模型路径准备',
    speakerSegmentationModel: '说话人分割模型路径准备',
    speakerEmbeddingModel: '说话人向量模型路径准备',
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
    const [activeProviderText, setActiveProviderText] = useState('未开始识别');
    const [activeNumThreadsText, setActiveNumThreadsText] = useState('-');
    const [speakerDiarizationEnabled, setSpeakerDiarizationEnabled] = useState(getSpeakerDiarizationEnabled());
    const [denoiseEnabled, setDenoiseEnabled] = useState(getDenoiseEnabled());
    const [vadSegments, setVadSegments] = useState<VadSegmentItem[]>([]);
    const [qwenStatusText, setQwenStatusText] = useState('待选择新闻样本');
    const [selectedNews, setSelectedNews] = useState(() => pickRandomNewsSample());
    const [qwenSummaryText, setQwenSummaryText] = useState('');
    const [qwenProgress, setQwenProgress] = useState<RemoteSummaryProgress | null>(null);
    const [qwenElapsedMs, setQwenElapsedMs] = useState<number | null>(null);
    const [qwenRemoteModel, setQwenRemoteModel] = useState<string | null>(null);
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
            const { transcribe, options: resolvedOptions } = await transcribeFileWithTiming({
                filePath: uri,
                modelId: currentModelId,
                preference: {
                    denoiseEnabled,
                    speakerDiarizationEnabled,
                },
            });
            const result = transcribe.result;
            const mainDecodeMs = Date.now() - mainDecodeStartedAt;
            const rawVadSegments = result.vadSegments ?? [];
            const normalizedSegments = rawVadSegments.filter(item => Boolean(item.path));
            const vadNoPathSegmentCount = rawVadSegments.length - normalizedSegments.length;
            const vadDurationTotalMs = rawVadSegments.reduce((sum, item) => sum + (item.durationMs ?? 0), 0);
            setVadSegments(normalizedSegments);
            const textAssembleStartedAt = Date.now();
            setConversionText(result.text);
            const textAssembleMs = Date.now() - textAssembleStartedAt;
            const totalMs = Date.now() - totalStartedAt;
            setConversionElapsedMs(totalMs);
            const timingSummary: FileRecognitionTiming = {
                preflightMs: 0,
                documentPickMs: 0,
                conversionTotalMs: transcribe.timing.totalMs,
                prepareRuntimePathsMs: transcribe.timing.prepareRuntimePathsMs,
                nativeTranscribeMs: transcribe.timing.nativeTranscribeMs,
                provider: transcribe.timing.provider,
                numThreads: transcribe.timing.numThreads,
                availableProcessors: transcribe.timing.availableProcessors,
                performanceTier: transcribe.timing.performanceTier,
                runtimePathPrepareSteps: transcribe.timing.runtimePathPrepare.steps.map(item => ({
                    key: item.key,
                    copied: item.copied,
                    skipped: item.skipped,
                    skipReason: item.skipReason,
                    elapsedMs: item.elapsedMs,
                })),
                mainDecodeMs,
                segmentCount: normalizedSegments.length,
                vadRawSegmentCount: rawVadSegments.length,
                vadNoPathSegmentCount,
                vadDurationTotalMs,
                textAssembleMs,
                totalMs,
            };
            setFileRecognitionTiming(timingSummary);
            setActiveProviderText(
                `${transcribe.timing.provider}（threads=${transcribe.timing.numThreads}, 核心=${transcribe.timing.availableProcessors}, 档位=${transcribe.timing.performanceTier}）`,
            );
            setActiveNumThreadsText(String(transcribe.timing.numThreads));
            console.info('[file-recognition][timing]', timingSummary);
            console.info('[file-recognition][options]', {
                modelId: currentModelId,
                ...resolvedOptions,
            });

            setFileRecognitionStatusText('文件识别完成');
            return true;
        } catch (error) {
            const message = (error as Error).message ?? 'unknown';
            setConversionElapsedMs(null);
            setFileRecognitionTiming(null);
            setVadSegments([]);
            setFileRecognitionStatusText(`文件识别失败: ${message}`);
            console.error('[file-recognition] failed', error);
            return false;
        }
    };

    const handlePickDocument = useCallback(async () => {
        const preflightStartedAt = Date.now();
        const canContinue = await runRecognitionPreflight('file');
        const preflightMs = Date.now() - preflightStartedAt;
        if (!canContinue) {
            return;
        }
        const pickStartedAt = Date.now();
        const selected = await pickDocument({ multiple: false });
        const documentPickMs = Date.now() - pickStartedAt;
        const success = await handleConversion(selected[0]?.uri);
        if (!success) {
            return;
        }
        setFileRecognitionTiming(prev => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                preflightMs,
                documentPickMs,
            };
        });
    }, [pickDocument, runRecognitionPreflight, handleConversion]);

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

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-6">
                <ButtonX onPress={handlePickDocument}>选择文件</ButtonX>
                <TextX>文件识别状态：{fileRecognitionStatusText}</TextX>
                <TextX>当前 Provider：{activeProviderText}</TextX>
                <TextX>当前线程数：{activeNumThreadsText}</TextX>
                <TextX>离线翻译结果：{conversionText}</TextX>
                {conversionElapsedMs === null ? null : <TextX>耗时：{(conversionElapsedMs / 1000).toFixed(2)} s</TextX>}
                {fileRecognitionTiming ? (
                    <View className="gap-1 rounded-lg border border-[#e5e7eb] p-3">
                        <TextX variant="subtitle">识别分阶段耗时</TextX>
                        <TextX variant="description">总耗时：{(fileRecognitionTiming.totalMs / 1000).toFixed(2)} s</TextX>
                        <TextX variant="description">前置检查：{(fileRecognitionTiming.preflightMs / 1000).toFixed(2)} s</TextX>
                        <TextX variant="description">文件选择：{(fileRecognitionTiming.documentPickMs / 1000).toFixed(2)} s</TextX>
                        <TextX variant="description">识别函数总耗时：{(fileRecognitionTiming.conversionTotalMs / 1000).toFixed(2)} s</TextX>
                        <TextX variant="description">主识别（含VAD输出）：{(fileRecognitionTiming.mainDecodeMs / 1000).toFixed(2)} s</TextX>
                        <TextX variant="description">
                            模型路径准备：{(fileRecognitionTiming.prepareRuntimePathsMs / 1000).toFixed(2)} s
                        </TextX>
                        <TextX variant="description">Native 推理：{(fileRecognitionTiming.nativeTranscribeMs / 1000).toFixed(2)} s</TextX>
                        <TextX variant="description">Provider：{fileRecognitionTiming.provider}</TextX>
                        <TextX variant="description">num_threads：{fileRecognitionTiming.numThreads}</TextX>
                        <TextX variant="description">设备核心数：{fileRecognitionTiming.availableProcessors}</TextX>
                        <TextX variant="description">设备档位：{fileRecognitionTiming.performanceTier}</TextX>
                        <TextX variant="description">分段数量：{fileRecognitionTiming.segmentCount}</TextX>
                        <TextX variant="description">VAD 原始分段数：{fileRecognitionTiming.vadRawSegmentCount}</TextX>
                        <TextX variant="description">VAD 空路径分段数：{fileRecognitionTiming.vadNoPathSegmentCount}</TextX>
                        <TextX variant="description">
                            VAD 分段总时长：{(fileRecognitionTiming.vadDurationTotalMs / 1000).toFixed(2)} s
                        </TextX>
                        <TextX variant="description">文本拼接与收尾：{(fileRecognitionTiming.textAssembleMs / 1000).toFixed(2)} s</TextX>
                        {fileRecognitionTiming.runtimePathPrepareSteps.length > 0 ? (
                            <View className="mt-1 gap-0.5">
                                {fileRecognitionTiming.runtimePathPrepareSteps.map(detail => {
                                    const label = RUNTIME_PATH_STEP_LABEL[detail.key] ?? detail.key;
                                    const action = detail.skipped
                                        ? `跳过${detail.skipReason ? `(${detail.skipReason})` : ''}`
                                        : detail.copied
                                          ? '已拷贝'
                                          : '已复用缓存';
                                    return (
                                        <TextX key={detail.key} variant="description">
                                            {label}：{(detail.elapsedMs / 1000).toFixed(2)} s（{action}）
                                        </TextX>
                                    );
                                })}
                            </View>
                        ) : null}
                    </View>
                ) : null}

                <View className="gap-2">
                    <TextX variant="description">
                        VAD 分段结果：{vadSegments.length > 0 ? `共 ${vadSegments.length} 段` : '暂无（请先完成一次识别）'}
                    </TextX>
                    {vadSegments.map(item => (
                        <View key={item.path} className="border-border rounded-xl border px-3 py-2">
                            <TextX>段 {item.index}</TextX>
                            <TextX numberOfLines={1} variant="description">
                                {item.path}
                            </TextX>
                            <TextX variant="description">时长: {(item.durationMs / 1000).toFixed(2)} s</TextX>
                            <TextX numberOfLines={2} variant="description">
                                文本: {item.text || '(空)'}
                            </TextX>
                        </View>
                    ))}
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
