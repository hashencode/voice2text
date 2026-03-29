import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack, useFocusEffect } from 'expo-router';
import { Aperture } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DefaultLayout } from '~/components/layout/default-layout';
import { ActionSheet } from '~/components/ui/action-sheet';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSheet } from '~/components/ui/bottom-sheet';
import { ButtonX } from '~/components/ui/buttonx';
import { Gallery, type GalleryItem } from '~/components/ui/gallery';
import { MediaPicker, type MediaAsset } from '~/components/ui/media-picker';
import { ModalMask } from '~/components/ui/modal-mask';
import { Picker } from '~/components/ui/picker';
import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { LoadingOverlay } from '~/components/ui/spinner';
import { TextX } from '~/components/ui/textx';
import { getDenoiseEnabled, getSpeakerDiarizationEnabled } from '~/db/mmkv/app-config';
import { getCurrentModel } from '~/db/mmkv/model-selection';
import { useFilePicker } from '~/hooks/useFilePicker';
import SherpaOnnx, { getInstalledModelVersion } from '~/modules/sherpa';
import { MIN_MODEL_VERSION_BY_MODEL_ID } from '~/scripts/const';
import { runRecognitionPreflight as runRecognitionPreflightTool } from '~/scripts/utils';

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
    const [vadSegments, setVadSegments] = useState<VadSegmentItem[]>([]);
    const [segmentRecognitionMap, setSegmentRecognitionMap] = useState<Record<string, SegmentRecognitionState>>({});
    const [playingVadPath, setPlayingVadPath] = useState<string | null>(null);
    const [isModalMaskVisible, setIsModalMaskVisible] = useState(false);
    const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [isAlertDialogVisible, setIsAlertDialogVisible] = useState(false);
    const [isLoadingOverlayVisible, setIsLoadingOverlayVisible] = useState(false);
    const [pickerValue, setPickerValue] = useState<string | undefined>(undefined);
    const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
    const vadPlayer = useAudioPlayer(null, { updateInterval: 200 });
    const vadPlayerStatus = useAudioPlayerStatus(vadPlayer);
    const galleryItems = React.useMemo<GalleryItem[]>(
        () => [
            { id: 'g-1', uri: 'https://picsum.photos/id/1011/800/600', title: '河流' },
            { id: 'g-2', uri: 'https://picsum.photos/id/1025/800/600', title: '小狗' },
            { id: 'g-3', uri: 'https://picsum.photos/id/1035/800/600', title: '山景' },
            { id: 'g-4', uri: 'https://picsum.photos/id/1043/800/600', title: '海边' },
        ],
        [],
    );

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
                <ButtonX onPress={handlePickDocument}>选择文件</ButtonX>
                <TextX>文件识别状态：{fileRecognitionStatusText}</TextX>
                <TextX>离线翻译结果：{conversionText}</TextX>
                {conversionElapsedMs === null ? null : <TextX>耗时：{(conversionElapsedMs / 1000).toFixed(2)} s</TextX>}

                <View className="gap-2 rounded-xl border border-zinc-300/70 p-3">
                    <TextX variant="subtitle">ButtonX 尺寸镜像展示</TextX>
                    <View className="flex-row items-center">
                        <View className="w-20">
                            <TextX variant="description">Size</TextX>
                        </View>
                        <View className="flex-1">
                            <TextX variant="description">仅 Icon</TextX>
                        </View>
                        <View className="flex-1">
                            <TextX variant="description">Icon + 文案</TextX>
                        </View>
                    </View>

                    <View className="flex-row items-center">
                        <View className="w-20">
                            <TextX>sm</TextX>
                        </View>
                        <View className="flex-1">
                            <ButtonX size="sm" variant="outline" icon={Aperture} />
                        </View>
                        <View className="flex-1">
                            <ButtonX size="sm" variant="outline" icon={Aperture}>
                                选择
                            </ButtonX>
                        </View>
                    </View>

                    <View className="flex-row items-center">
                        <View className="w-20">
                            <TextX>default</TextX>
                        </View>
                        <View className="flex-1">
                            <ButtonX variant="outline" icon={Aperture} />
                        </View>
                        <View className="flex-1">
                            <ButtonX variant="outline" icon={Aperture}>
                                确认
                            </ButtonX>
                        </View>
                    </View>

                    <View className="flex-row items-center">
                        <View className="w-20">
                            <TextX>lg</TextX>
                        </View>
                        <View className="flex-1">
                            <ButtonX size="lg" variant="outline" icon={Aperture} />
                        </View>
                        <View className="flex-1">
                            <ButtonX size="lg" variant="outline" icon={Aperture}>
                                开始
                            </ButtonX>
                        </View>
                    </View>
                </View>

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

                <View className="mt-4 gap-3 rounded-2xl border border-emerald-400/60 p-3">
                    <TextX variant="subtitle">ModalMask 改造验证区（V2）</TextX>
                    <TextX variant="description">本区为本次改造新增 demo，和下方历史 demo（V1）区分开。</TextX>
                    <View className="flex-row flex-wrap gap-2">
                        <ButtonX size="sm" variant="outline" onPress={() => setIsAlertDialogVisible(true)}>
                            打开 AlertDialog
                        </ButtonX>
                        <ButtonX size="sm" variant="outline" onPress={() => setIsLoadingOverlayVisible(prev => !prev)}>
                            {isLoadingOverlayVisible ? '关闭 LoadingOverlay' : '打开 LoadingOverlay'}
                        </ButtonX>
                    </View>
                    <View className="gap-2">
                        <TextX variant="description">Picker（ModalMask 单层）</TextX>
                        <Picker
                            value={pickerValue}
                            onValueChange={setPickerValue}
                            modalTitle="选择测试选项"
                            options={[
                                { label: '改造已完成', value: 'done' },
                                { label: '需要优化动画', value: 'optimize' },
                                { label: '继续验证', value: 'verify' },
                            ]}
                        />
                        <TextX variant="description">当前值：{pickerValue ?? '(未选择)'}</TextX>
                    </View>
                    <View className="gap-2">
                        <TextX variant="description">MediaPicker（ModalMask slide-up）</TextX>
                        <MediaPicker
                            gallery
                            multiple
                            maxSelection={3}
                            buttonText="打开媒体选择器"
                            onSelectionChange={setMediaAssets}
                            onError={error => setFileRecognitionStatusText(`MediaPicker 错误: ${error}`)}
                        />
                        <TextX variant="description">已选资源数：{mediaAssets.length}</TextX>
                    </View>
                    <View className="gap-2">
                        <TextX variant="description">Gallery（ModalMask fullscreen）</TextX>
                        <View className="h-48 overflow-hidden rounded-xl border border-zinc-300">
                            <Gallery items={galleryItems} columns={2} spacing={6} borderRadius={10} />
                        </View>
                    </View>
                </View>

                <View className="mt-4 gap-3 rounded-2xl border border-zinc-300/60 p-3">
                    <TextX variant="subtitle">历史 Overlay / ModalMask 组件测试（V1）</TextX>
                    <View className="flex-row flex-wrap gap-2">
                        <ButtonX size="sm" variant="outline" onPress={() => setIsModalMaskVisible(true)}>
                            打开 ModalMask
                        </ButtonX>
                        <ButtonX size="sm" variant="outline" onPress={() => setIsActionSheetVisible(true)}>
                            打开 ActionSheet
                        </ButtonX>
                        <ButtonX size="sm" variant="outline" onPress={() => setIsSheetOpen(true)}>
                            打开 Sheet
                        </ButtonX>
                        <ButtonX size="sm" variant="outline" onPress={() => setIsBottomSheetVisible(true)}>
                            打开 BottomSheet
                        </ButtonX>
                    </View>

                    <View className="gap-2">
                        <TextX variant="description">Popover Demo</TextX>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                            <PopoverTrigger asChild>
                                <ButtonX size="sm" variant="outline">
                                    打开 Popover
                                </ButtonX>
                            </PopoverTrigger>
                            <PopoverContent side="bottom" align="start">
                                <PopoverBody>
                                    <TextX>这是 Popover 内容，用于验证 ModalMask 替代是否正常。</TextX>
                                </PopoverBody>
                            </PopoverContent>
                        </Popover>
                    </View>
                </View>
            </ScrollView>

            <ModalMask
                isVisible={isModalMaskVisible}
                onPressMask={() => setIsModalMaskVisible(false)}
                renderMask={({ defaultMask }) => defaultMask}
                contentTransitionPreset="scale">
                <View className="flex-1 items-center justify-center px-6">
                    <View className="bg-card border-border w-full rounded-2xl border bg-white p-4">
                        <TextX variant="subtitle">ModalMask 测试弹层</TextX>
                        <TextX variant="description" className="mt-2">
                            点击空白遮罩区域可关闭，用于验证 SharedValue 动画和点击关闭逻辑。
                        </TextX>
                        <View className="mt-4">
                            <ButtonX size="sm" onPress={() => setIsModalMaskVisible(false)}>
                                关闭
                            </ButtonX>
                        </View>
                    </View>
                </View>
            </ModalMask>

            <ActionSheet
                visible={isActionSheetVisible}
                onClose={() => setIsActionSheetVisible(false)}
                title="ActionSheet Demo"
                message="验证 ModalMask 替代后的遮罩和动画"
                options={[
                    { title: '普通操作', onPress: () => setIsActionSheetVisible(false) },
                    { title: '危险操作', destructive: true, onPress: () => setIsActionSheetVisible(false) },
                ]}
                cancelButtonTitle="取消"
            />

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Sheet Demo</SheetTitle>
                        <SheetDescription>验证侧边抽屉遮罩与关闭逻辑</SheetDescription>
                    </SheetHeader>
                    <View className="p-4">
                        <ButtonX size="sm" onPress={() => setIsSheetOpen(false)}>
                            关闭 Sheet
                        </ButtonX>
                    </View>
                </SheetContent>
            </Sheet>

            <BottomSheet isVisible={isBottomSheetVisible} onClose={() => setIsBottomSheetVisible(false)} title="BottomSheet Demo">
                <TextX variant="description">验证底部弹层在 ModalMask 下的遮罩与手势行为。</TextX>
                <View className="mt-4">
                    <ButtonX size="sm" onPress={() => setIsBottomSheetVisible(false)}>
                        关闭 BottomSheet
                    </ButtonX>
                </View>
            </BottomSheet>

            <AlertDialog
                isVisible={isAlertDialogVisible}
                onClose={() => setIsAlertDialogVisible(false)}
                title="AlertDialog（V2）"
                description="该弹窗已迁移到 ModalMask + 预设动画。"
                confirmText="知道了"
                cancelText="取消"
            />

            <LoadingOverlay
                visible={isLoadingOverlayVisible}
                showLabel
                label="加载中..."
                variant="dots"
                onRequestClose={() => setIsLoadingOverlayVisible(false)}
            />
        </DefaultLayout>
    );
}
