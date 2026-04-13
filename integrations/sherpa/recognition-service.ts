import * as FileSystem from 'expo-file-system/legacy';
import { getDenoiseEnabled, getSpeakerDiarizationEnabled, type VadEngineId } from '~/data/mmkv/app-config';
import SherpaOnnx, {
    type SherpaDownloadedModelTranscribeWithTiming,
    type SherpaModelId,
    type SherpaTranscribeOptions,
} from '~/modules/sherpa';

const DEFAULT_SPEAKER_SEGMENTATION_MODEL = 'sherpa/onnx/speaker-diarization.onnx';
const DEFAULT_SPEAKER_EMBEDDING_MODEL = 'sherpa/onnx/speaker-recognition.onnx';
const TARGET_RECOGNITION_SAMPLE_RATE = 16000;

function buildTranscodeTempPath(): string {
    const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!root) {
        throw new Error('File system directory is unavailable');
    }
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${root}sherpa/transcode/recognition-${nonce}-16k.wav`;
}

async function ensureInputSampleRate16k(filePath: string): Promise<{
    path: string;
    inputSampleRate: number;
    transcoded: boolean;
    cleanup: () => Promise<void>;
}> {
    const info = await SherpaOnnx.getAudioFileInfo(filePath);
    const sampleRate = info.sampleRate;
    if (sampleRate === TARGET_RECOGNITION_SAMPLE_RATE) {
        return {
            path: filePath,
            inputSampleRate: sampleRate,
            transcoded: false,
            cleanup: async () => {},
        };
    }

    const outputPath = buildTranscodeTempPath();
    const tempDir = outputPath.split('/').slice(0, -1).join('/') + '/';
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    await SherpaOnnx.convertAudioToFormat(filePath, outputPath, 'wav', {
        sampleRate: TARGET_RECOGNITION_SAMPLE_RATE,
        channels: 1,
        sampleFormat: 's16',
    });
    return {
        path: outputPath,
        inputSampleRate: sampleRate,
        transcoded: true,
        cleanup: async () => {
            try {
                await FileSystem.deleteAsync(outputPath, { idempotent: true });
            } catch {
                // no-op
            }
        },
    };
}

export type RecognitionPreference = {
    denoiseEnabled?: boolean;
    speakerDiarizationEnabled?: boolean;
};

export type RecognitionRunContext = {
    modelId: SherpaModelId;
    filePath: string;
    preference?: RecognitionPreference;
    overrides?: SherpaTranscribeOptions;
};

function resolveVadEngineByModel(modelId: SherpaModelId): VadEngineId {
    return modelId === 'moonshine-zh' ? 'tenvad' : 'silerovad';
}

function resolvePreference(preference?: RecognitionPreference): Required<RecognitionPreference> {
    return {
        denoiseEnabled: preference?.denoiseEnabled ?? getDenoiseEnabled(),
        speakerDiarizationEnabled: preference?.speakerDiarizationEnabled ?? getSpeakerDiarizationEnabled(),
    };
}

export function buildDefaultTranscribeOptions(
    modelId: SherpaModelId,
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
        vadEngine: resolveVadEngineByModel(modelId),
        wavReadMode: 'streaming',
        ...overrides,
    };
}

export async function transcribeFileWithTiming(context: RecognitionRunContext): Promise<{
    transcribe: SherpaDownloadedModelTranscribeWithTiming;
    options: SherpaTranscribeOptions;
}> {
    const options = buildDefaultTranscribeOptions(context.modelId, context.preference, context.overrides);
    const prepared = await ensureInputSampleRate16k(context.filePath);
    try {
        if (prepared.transcoded) {
            console.info('[recognition] auto-transcoded input to 16k', {
                sourceSampleRate: prepared.inputSampleRate,
                sourcePath: context.filePath,
            });
        }
        const transcribe = await SherpaOnnx.transcribeWavByDownloadedModelWithTiming(prepared.path, context.modelId, options);
        return {
            transcribe,
            options,
        };
    } finally {
        await prepared.cleanup();
    }
}
