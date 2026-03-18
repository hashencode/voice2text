import { useFocusEffect } from '@react-navigation/native';
import { Stack } from 'expo-router';

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
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
            const r1 = await SherpaOnnx.transcribeWavByDownloadedModel(uri, currentModelId, {
                enableDenoise: denoiseEnabled,
                enableSpeakerDiarization: speakerDiarizationEnabled,
                speakerSegmentationModel: DEFAULT_SPEAKER_SEGMENTATION_MODEL,
                speakerEmbeddingModel: DEFAULT_SPEAKER_EMBEDDING_MODEL,
            });
            setConversionElapsedMs(Date.now() - startedAt);
            setConversionText(r1.text);
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
            <View className="gap-4 p-4">
                <Button onPress={handlePickDocument}>选择文件</Button>
                <Button loading={recordingActionLoading} onPress={toggleRecordAndTranscribe}>
                    {isRecordingByButton ? '停止录音并识别' : '开始录音'}
                </Button>
                <TextX>录音状态：{recordingStatusText}</TextX>
                <TextX>文件识别状态：{fileRecognitionStatusText}</TextX>
                <TextX>离线翻译结果：{conversionText}</TextX>
                {conversionElapsedMs === null ? null : <TextX>耗时：{(conversionElapsedMs / 1000).toFixed(2)} s</TextX>}
            </View>
        </DefaultLayout>
    );
}
