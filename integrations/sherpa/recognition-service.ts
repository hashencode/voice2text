import {
    getDenoiseEnabled,
    getSpeakerDiarizationEnabled,
    getVadEngine,
    type VadEngineId,
} from '~/data/mmkv/app-config';
import SherpaOnnx, {
    type SherpaDownloadedModelTranscribeWithTiming,
    type SherpaModelId,
    type SherpaTranscribeOptions,
    type SherpaTranscribeResult,
} from '~/modules/sherpa';

const DEFAULT_SPEAKER_SEGMENTATION_MODEL = 'sherpa/onnx/speaker-diarization.onnx';
const DEFAULT_SPEAKER_EMBEDDING_MODEL = 'sherpa/onnx/speaker-recognition.onnx';

export type RecognitionPreference = {
    denoiseEnabled?: boolean;
    speakerDiarizationEnabled?: boolean;
    vadEngine?: VadEngineId;
};

export type RecognitionRunContext = {
    modelId: SherpaModelId;
    filePath: string;
    preference?: RecognitionPreference;
    overrides?: SherpaTranscribeOptions;
};

function resolvePreference(preference?: RecognitionPreference): Required<RecognitionPreference> {
    return {
        denoiseEnabled: preference?.denoiseEnabled ?? getDenoiseEnabled(),
        speakerDiarizationEnabled: preference?.speakerDiarizationEnabled ?? getSpeakerDiarizationEnabled(),
        vadEngine: preference?.vadEngine ?? getVadEngine(),
    };
}

export function buildDefaultTranscribeOptions(
    preference?: RecognitionPreference,
    overrides: SherpaTranscribeOptions = {},
): SherpaTranscribeOptions {
    const resolved = resolvePreference(preference);
    return {
        debug: true,
        enableDenoise: resolved.denoiseEnabled,
        enableSpeakerDiarization: resolved.speakerDiarizationEnabled,
        speakerSegmentationModel: DEFAULT_SPEAKER_SEGMENTATION_MODEL,
        speakerEmbeddingModel: DEFAULT_SPEAKER_EMBEDDING_MODEL,
        vadMaxSpeechDuration: 20,
        vadEngine: resolved.vadEngine,
        wavReadMode: 'streaming',
        ...overrides,
    };
}

export async function transcribeFileWithTiming(context: RecognitionRunContext): Promise<{
    transcribe: SherpaDownloadedModelTranscribeWithTiming;
    options: SherpaTranscribeOptions;
}> {
    const options = buildDefaultTranscribeOptions(context.preference, context.overrides);
    const transcribe = await SherpaOnnx.transcribeWavByDownloadedModelWithTiming(context.filePath, context.modelId, options);
    return {
        transcribe,
        options,
    };
}

export async function transcribeSegmentQuick(context: RecognitionRunContext): Promise<{
    result: SherpaTranscribeResult;
    options: SherpaTranscribeOptions;
}> {
    const options = buildDefaultTranscribeOptions(context.preference, {
        enableVad: false,
        enableSpeakerDiarization: false,
        ...context.overrides,
    });
    const result = await SherpaOnnx.transcribeWavByDownloadedModel(context.filePath, context.modelId, options);
    return {
        result,
        options,
    };
}
