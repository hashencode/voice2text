import { Asset } from 'expo-asset';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { getDenoiseEnabled, getSpeakerDiarizationEnabled } from '~/data/mmkv/app-config';
import { getCurrentModel } from '~/data/mmkv/model-selection';
import { pickRandomNewsSample } from '~/features/test/data/news-samples';
import { summarizeTextByRemoteApi, type RemoteSummaryProgress } from '~/integrations/llm/remote-summary';
import { transcribeFileWithTiming } from '~/integrations/sherpa/recognition-service';
import { getInstalledModelVersion } from '~/modules/sherpa';
import { MIN_MODEL_VERSION_BY_MODEL_ID } from '~/scripts/const';
import { runRecognitionPreflight as runRecognitionPreflightTool } from '~/scripts/utils';

const DEFAULT_TEST_WAV_MODULE = require('../../assets/sherpa/wav/test.wav');

const REFERENCE_SEGMENTS = [
    { timestamp: '29.776 -- 35.788', text: '朋友们晚上好，欢迎大家来参加今天晚上的活动。谢谢大家。' },
    { timestamp: '42.160 -- 45.996', text: '这是我第四次办年度演讲。' },
    { timestamp: '47.024 -- 49.868', text: '前三次呢，因为疫情的原因。' },
    { timestamp: '50.512 -- 55.340', text: '都在小米科技园内举办，现场的人很少。' },
    { timestamp: '56.176 -- 57.388', text: '这是第四次。' },
    { timestamp: '58.192 -- 66.892', text: '我们仔细想了想，我们还是想办一个比较大的聚会，然后呢，让我们的新朋友、老朋友一起聚一聚。' },
    { timestamp: '67.760 -- 70.828', text: '今天的话呢，我们就在北京的。' },
    { timestamp: '71.664 -- 74.828', text: '国家会议中心呢，举办了这么一个活动。' },
    { timestamp: '75.472 -- 85.868', text: '现场呢，来了很多人，大概有三千五百人，还有很多很多的朋友呢，通过观看直播的方式来参与。' },
    { timestamp: '86.352 -- 91.308', text: '再一次呢，对大家的参加表示感谢，谢谢大家。' },
    { timestamp: '98.512 -- 99.692', text: '两个月前。' },
    { timestamp: '100.400 -- 104.396', text: '我参加了今年武汉大学的毕业典礼。' },
    { timestamp: '105.936 -- 107.276', text: '今年呢是。' },
    { timestamp: '107.888 -- 110.572', text: '武汉大学建校一百三十周年。' },
    { timestamp: '111.760 -- 117.196', text: '作为校友，被母校邀请，在毕业典礼上致辞。' },
    { timestamp: '118.032 -- 122.732', text: '这对我来说是至高无上的荣誉。' },
    { timestamp: '123.664 -- 128.556', text: '站在讲台的那一刻，面对全校师生。' },
    { timestamp: '129.200 -- 134.252', text: '关于武大的所有的记忆，一下子涌现在脑海里。' },
    { timestamp: '134.960 -- 139.436', text: '今天呢，我就先和大家聊聊五大往事。' },
    { timestamp: '141.840 -- 143.980', text: '那还是三十六年前。' },
    { timestamp: '145.936 -- 147.660', text: '一九八七年。' },
    { timestamp: '148.688 -- 151.564', text: '我呢，考上了武汉大学的计算机系。' },
    { timestamp: '152.688 -- 156.748', text: '在武汉大学的图书馆里，看了一本书。' },
    { timestamp: '157.584 -- 161.804', text: '硅谷之火，建立了我一生的梦想。' },
    { timestamp: '163.312 -- 164.652', text: '看完书以后。' },
    { timestamp: '165.264 -- 166.636', text: '热血沸腾。' },
    { timestamp: '167.600 -- 169.548', text: '激动得睡不着觉。' },
    { timestamp: '170.416 -- 171.404', text: '我还记得。' },
    { timestamp: '172.016 -- 174.700', text: '那天晚上，星光很亮。' },
    { timestamp: '175.408 -- 179.820', text: '我就在武大的操场上，就是屏幕上这个操场。' },
    { timestamp: '180.816 -- 185.228', text: '走了一圈又一圈，走了整整一个晚上。' },
    { timestamp: '186.480 -- 187.916', text: '我心里有团火。' },
    { timestamp: '188.912 -- 192.076', text: '我也想搬一个伟大的公司。' },
    { timestamp: '193.968 -- 195.020', text: '就是这样。' },
    { timestamp: '197.648 -- 202.316', text: '梦想之火，在我心里彻底点燃了。' },
    { timestamp: '209.968 -- 212.396', text: '是一个大一的新生。' },
    { timestamp: '220.496 -- 222.636', text: '是一个大一的新生。' },
    { timestamp: '223.984 -- 226.892', text: '一个从县城里出来的年轻人。' },
    { timestamp: '228.368 -- 230.604', text: '什么也不会，什么也没有。' },
    { timestamp: '231.568 -- 236.204', text: '就想创办一家伟大的公司，这不就是天方夜谭吗？' },
    { timestamp: '237.616 -- 239.788', text: '这么离谱的一个梦想。' },
    { timestamp: '240.400 -- 242.316', text: '该如何实现呢？' },
    { timestamp: '243.856 -- 246.924', text: '那天晚上，我想了一整晚上。' },
    { timestamp: '247.952 -- 249.068', text: '说实话。' },
    { timestamp: '250.352 -- 253.868', text: '越想越糊涂，完全理不清头绪。' },
    {
        timestamp: '254.960 -- 265.836',
        text: '后来我在想：“哎，干脆别想了，把书念好是正事。”所以呢，我就下定决心，认认真真读书。',
    },
    { timestamp: '266.640 -- 267.468', text: '那么。' },
    { timestamp: '268.496 -- 271.564', text: '我怎么能够把书读得不同凡响呢？' },
] as const;

const REFERENCE_TEXT = REFERENCE_SEGMENTS.map(item => item.text).join('');

async function resolveDefaultTestWavUri(): Promise<string> {
    const asset = Asset.fromModule(DEFAULT_TEST_WAV_MODULE);
    if (!asset.localUri) {
        await asset.downloadAsync();
    }
    const resolved = asset.localUri ?? asset.uri;
    if (!resolved) {
        throw new Error('默认 test.wav 路径不可用');
    }
    return resolved;
}

type CompareItem = {
    char: string;
    matched: boolean;
};

type LcsCompareResult = {
    referenceItems: CompareItem[];
    recognizedItems: CompareItem[];
};

function isPunctuationChar(char: string): boolean {
    return /[，。！？；：“”‘’（）【】《》〈〉、,.!?;:'"()[\]{}<>…—-]/.test(char);
}

function buildLcsCompare(reference: string, recognized: string): LcsCompareResult {
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

    const matchedRef = new Array<boolean>(m).fill(false);
    const matchedRec = new Array<boolean>(n).fill(false);
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        if (refChars[i - 1] === recChars[j - 1]) {
            matchedRef[i - 1] = true;
            matchedRec[j - 1] = true;
            i -= 1;
            j -= 1;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            i -= 1;
        } else {
            j -= 1;
        }
    }

    return {
        referenceItems: refChars.map((char, index) => ({
            char,
            matched: matchedRef[index],
        })),
        recognizedItems: recChars.map((char, index) => ({
            char,
            matched: matchedRec[index],
        })),
    };
}

function formatRecognizedChar(item: CompareItem): string {
    if (item.matched || isPunctuationChar(item.char)) {
        return item.char;
    }
    if (item.char.trim().length === 0) {
        return item.char;
    }
    return `(${item.char})`;
}

function getRecognizedCharColor(item: CompareItem): string {
    if (item.matched) {
        return '#16a34a';
    }
    if (isPunctuationChar(item.char)) {
        return '#111827';
    }
    return '#dc2626';
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
    const [fileRecognitionStatusText, setFileRecognitionStatusText] = useState('待识别（默认 test.wav）');
    const [activeProviderText, setActiveProviderText] = useState('未开始识别');
    const [activeNumThreadsText, setActiveNumThreadsText] = useState('-');
    const [speakerDiarizationEnabled, setSpeakerDiarizationEnabled] = useState(getSpeakerDiarizationEnabled());
    const [denoiseEnabled, setDenoiseEnabled] = useState(getDenoiseEnabled());
    const [qwenStatusText, setQwenStatusText] = useState('待选择新闻样本');
    const [selectedNews, setSelectedNews] = useState(() => pickRandomNewsSample());
    const [qwenSummaryText, setQwenSummaryText] = useState('');
    const [qwenProgress, setQwenProgress] = useState<RemoteSummaryProgress | null>(null);
    const [qwenElapsedMs, setQwenElapsedMs] = useState<number | null>(null);
    const [qwenRemoteModel, setQwenRemoteModel] = useState<string | null>(null);
    const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
    const [compareSummary, setCompareSummary] = useState('未开始对比');
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

    const runRecognitionPreflight = useCallback(async (kind: 'file' | 'recording'): Promise<boolean> => {
        const modelId = getCurrentModel();
        return runRecognitionPreflightTool({
            kind,
            modelId,
        });
    }, []);

    const handleConversion = async (uri: string): Promise<boolean> => {
        setFileRecognitionStatusText('文件识别中...');
        setConversionElapsedMs(null);
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
            setFileRecognitionStatusText(`文件识别失败: ${message}`);
            console.error('[file-recognition] failed', error);
            return false;
        }
    };

    const handleRecognizeDefaultTestFile = useCallback(async () => {
        const canContinue = await runRecognitionPreflight('file');
        if (!canContinue) {
            return;
        }
        try {
            const uri = await resolveDefaultTestWavUri();
            await handleConversion(uri);
        } catch (error) {
            setFileRecognitionStatusText(`默认 test.wav 加载失败: ${(error as Error).message}`);
        }
    }, [runRecognitionPreflight, handleConversion]);

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
        const comparedWithoutPunctuation = compared.referenceItems.filter(item => !isPunctuationChar(item.char));
        const hitCount = comparedWithoutPunctuation.filter(item => item.matched).length;
        const total = comparedWithoutPunctuation.length;
        const hitRate = total > 0 ? ((hitCount / total) * 100).toFixed(2) : '0.00';
        setCompareItems(compared.recognizedItems);
        setCompareSummary(`命中 ${hitCount}/${total}（${hitRate}%）`);
    }, [conversionText]);

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
                <View className="flex-row items-center gap-2">
                    <ButtonX onPress={handleRecognizeDefaultTestFile}>识别</ButtonX>
                    <ButtonX variant="outline" onPress={handleCompareReferenceText}>
                        对比
                    </ButtonX>
                </View>
                <TextX>文件识别状态：{fileRecognitionStatusText}</TextX>
                <TextX>当前 Provider：{activeProviderText}</TextX>
                <TextX>当前线程数：{activeNumThreadsText}</TextX>
                <View className="gap-1">
                    <TextX>离线翻译结果：</TextX>
                    {compareItems.length > 0 ? (
                        <Text>
                            {compareItems.map((item, index) => (
                                <Text key={`${item.char}-${index}`} style={{ color: getRecognizedCharColor(item) }}>
                                    {formatRecognizedChar(item)}
                                </Text>
                            ))}
                        </Text>
                    ) : (
                        <TextX>{conversionText}</TextX>
                    )}
                </View>
                <View className="gap-2 rounded-lg border border-[#e5e7eb] p-3">
                    <TextX variant="description">{compareSummary}</TextX>
                </View>
                {conversionElapsedMs === null ? null : <TextX>耗时：{(conversionElapsedMs / 1000).toFixed(2)} s</TextX>}

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
