import { Stack, useFocusEffect } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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

const REFERENCE_TEXT =
    '北京科技馆是的就我也是在某一个夏天然后才开始培养出来游泳这个习惯的但是最近天气好像就还没有热到那种程度是的嗯那你平时喜欢干嘛呀哦所以你平你你喜欢看日本动漫是吗就有一个女生进来嗯我还是在校大学生我是学英语翻译我籍贯是内蒙古赤峰然后我的出生地在吉林吉林长春啊对对但是上大学会有很多同学问说你们是不是街道上都跑马呀这种这种话听的挺多的我今年是二十一岁';

type CompareItem = {
    char: string;
    matched: boolean;
};

function buildLcsCompare(reference: string, recognized: string): CompareItem[] {
    const refChars = Array.from(reference);
    const recChars = Array.from(recognized);
    const m = refChars.length;
    const n = recChars.length;
    const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

    for (let i = 1; i <= m; i += 1) {
        for (let j = 1; j <= n; j += 1) {
            if (refChars[i - 1] === recChars[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    const matched = new Array<boolean>(m).fill(false);
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        if (refChars[i - 1] === recChars[j - 1]) {
            matched[i - 1] = true;
            i -= 1;
            j -= 1;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            i -= 1;
        } else {
            j -= 1;
        }
    }

    return refChars.map((char, index) => ({
        char,
        matched: matched[index],
    }));
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
    const [conversionElapsedMs, setConversionElapsedMs] = useState<number | null>(null);
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
    const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
    const [compareSummary, setCompareSummary] = useState('未开始对比');
    const [playingSegmentPath, setPlayingSegmentPath] = useState<string | null>(null);
    const segmentPlayer = useAudioPlayer(null, { updateInterval: 200 });
    const segmentPlayerStatus = useAudioPlayerStatus(segmentPlayer);
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
            await segmentPlayer.pause();
        } catch {
            // no-op
        }
        setPlayingSegmentPath(null);
        try {
            const currentModelId = getCurrentModel();
            const totalStartedAt = Date.now();
            const { transcribe, options: resolvedOptions } = await transcribeFileWithTiming({
                filePath: uri,
                modelId: currentModelId,
                preference: {
                    denoiseEnabled,
                    speakerDiarizationEnabled,
                },
            });
            const result = transcribe.result;
            const rawVadSegments = result.vadSegments ?? [];
            const normalizedSegments = rawVadSegments.filter(item => Boolean(item.path));
            setVadSegments(normalizedSegments);
            setConversionText(result.text);
            const totalMs = Date.now() - totalStartedAt;
            setConversionElapsedMs(totalMs);
            setActiveProviderText(
                `${transcribe.timing.provider}（threads=${transcribe.timing.numThreads}, 核心=${transcribe.timing.availableProcessors}, 档位=${transcribe.timing.performanceTier}）`,
            );
            setActiveNumThreadsText(String(transcribe.timing.numThreads));
            console.info('[file-recognition][options]', {
                modelId: currentModelId,
                ...resolvedOptions,
            });

            setFileRecognitionStatusText('文件识别完成');
            return true;
        } catch (error) {
            const message = (error as Error).message ?? 'unknown';
            setConversionElapsedMs(null);
            setVadSegments([]);
            setPlayingSegmentPath(null);
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

    const handleCompareReferenceText = useCallback(() => {
        const recognized = conversionText.trim();
        if (!recognized) {
            setCompareItems([]);
            setCompareSummary('无离线翻译结果，无法对比');
            return;
        }
        const compared = buildLcsCompare(REFERENCE_TEXT, recognized);
        const hitCount = compared.filter(item => item.matched).length;
        const total = compared.length;
        const hitRate = total > 0 ? ((hitCount / total) * 100).toFixed(2) : '0.00';
        setCompareItems(compared);
        setCompareSummary(`命中 ${hitCount}/${total}（${hitRate}%）`);
    }, [conversionText]);

    const handlePlaySegment = useCallback(
        async (segment: VadSegmentItem) => {
            if (!segment.path) {
                return;
            }
            try {
                if (playingSegmentPath === segment.path && segmentPlayerStatus.playing) {
                    await segmentPlayer.pause();
                    setPlayingSegmentPath(null);
                    return;
                }
                segmentPlayer.replace(segment.path);
                segmentPlayer.play();
                setPlayingSegmentPath(segment.path);
            } catch (error) {
                console.error('[test][play-segment] failed', error);
                setPlayingSegmentPath(null);
            }
        },
        [playingSegmentPath, segmentPlayer, segmentPlayerStatus.playing],
    );

    useEffect(() => {
        if (!segmentPlayerStatus.playing && segmentPlayerStatus.didJustFinish) {
            setPlayingSegmentPath(null);
        }
    }, [segmentPlayerStatus.didJustFinish, segmentPlayerStatus.playing]);

    useEffect(() => {
        return () => {
            void segmentPlayer.pause();
        };
    }, [segmentPlayer]);

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
                <View className="gap-2 rounded-lg border border-[#e5e7eb] p-3">
                    <View className="flex-row items-center gap-2">
                        <ButtonX size="sm" onPress={handleCompareReferenceText}>
                            对比
                        </ButtonX>
                        <TextX variant="description">{compareSummary}</TextX>
                    </View>
                    <TextX variant="description">标准文本：</TextX>
                    <Text>{REFERENCE_TEXT}</Text>
                    {compareItems.length > 0 ? (
                        <View className="gap-1">
                            <TextX variant="description">对比结果（绿色=命中，红色=未命中）</TextX>
                            <Text>
                                {compareItems.map((item, index) => (
                                    <Text key={`${item.char}-${index}`} style={{ color: item.matched ? '#16a34a' : '#dc2626' }}>
                                        {item.char}
                                    </Text>
                                ))}
                            </Text>
                        </View>
                    ) : null}
                </View>
                {conversionElapsedMs === null ? null : <TextX>耗时：{(conversionElapsedMs / 1000).toFixed(2)} s</TextX>}

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
                            <ButtonX size="sm" variant="outline" onPress={() => void handlePlaySegment(item)}>
                                {playingSegmentPath === item.path && segmentPlayerStatus.playing ? '暂停' : '播放'}
                            </ButtonX>
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
