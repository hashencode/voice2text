import * as FileSystem from 'expo-file-system/legacy';
import { requireNativeModule } from 'expo-modules-core';

export type SherpaTranscribeOptions = {
    modelDirAsset?: string;
    modelDir?: string;
    modelType?: 'transducer' | 'zipformer' | 'zipformer2' | 'zipformer2_ctc' | 'zipformer_ctc' | 'ctc' | string;
    encoder?: string;
    decoder?: string;
    joiner?: string;
    model?: string;
    tokens?: string;
    sampleRate?: number;
    featureDim?: number;
    numThreads?: number;
    provider?: 'cpu' | 'xnnpack' | string;
    debug?: boolean;
    decodingMethod?: 'greedy_search' | 'modified_beam_search' | string;
    maxActivePaths?: number;
    blankPenalty?: number;
};

export type SherpaTranscribeResult = {
    text: string;
    tokens: string[];
    timestamps: number[];
    durations: number[];
    lang: string;
    emotion: string;
    event: string;
    sampleRate: number;
    numSamples: number;
};

type SherpaOnnxNative = {
    hello(): string;
    transcribeWav(path: string, options?: SherpaTranscribeOptions): Promise<SherpaTranscribeResult>;
    transcribeAssetWav(assetPath: string, options?: SherpaTranscribeOptions): Promise<SherpaTranscribeResult>;
};

export const SHERPA_MODEL_PRESETS = {
    'streaming-zipformer-zh-int8-2025-06-30': {
        modelType: 'transducer',
        modelDirAsset: 'sherpa/models/sherpa-onnx-streaming-zipformer-zh-int8-2025-06-30',
        encoder: 'encoder.onnx',
        decoder: 'decoder.onnx',
        joiner: 'joiner.onnx',
        tokens: 'tokens.txt',
    },
    'streaming-zipformer-en-2023-06-26': {
        modelType: 'transducer',
        modelDirAsset: 'sherpa/models/sherpa-onnx-streaming-zipformer-en-2023-06-26',
        encoder: 'encoder.onnx',
        decoder: 'decoder.onnx',
        joiner: 'joiner.onnx',
        tokens: 'tokens.txt',
    },
    'streaming-zipformer-bilingual-zh-en-2023-02-20': {
        modelType: 'transducer',
        modelDirAsset: 'sherpa/models/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20',
        encoder: 'encoder.onnx',
        decoder: 'decoder.onnx',
        joiner: 'joiner.onnx',
        tokens: 'tokens.txt',
    },
    'zipformer-en-2023-06-26': {
        modelType: 'transducer',
        modelDirAsset: 'sherpa/models/sherpa-onnx-zipformer-en-2023-06-26',
        encoder: 'encoder.onnx',
        decoder: 'decoder.onnx',
        joiner: 'joiner.onnx',
        tokens: 'tokens.txt',
    },
    'zipformer-small-en-2023-06-26': {
        modelType: 'transducer',
        modelDirAsset: 'sherpa/models/sherpa-onnx-zipformer-small-en-2023-06-26',
        encoder: 'encoder.onnx',
        decoder: 'decoder.onnx',
        joiner: 'joiner.onnx',
        tokens: 'tokens.txt',
    },
    'zipformer-zh-en-2023-11-22': {
        modelType: 'transducer',
        modelDirAsset: 'sherpa/models/zipformer-zh-en-2023-11-22',
        encoder: 'encoder.onnx',
        decoder: 'decoder.onnx',
        joiner: 'joiner.onnx',
        tokens: 'tokens.txt',
    },
    'zipformer-ctc-zh-int8-2025-07-03': {
        modelType: 'zipformer2_ctc',
        modelDirAsset: 'sherpa/models/sherpa-onnx-zipformer-ctc-zh-int8-2025-07-03',
        model: 'model.onnx',
        tokens: 'tokens.txt',
    },
} as const satisfies Record<string, SherpaTranscribeOptions>;

export type SherpaModelId = keyof typeof SHERPA_MODEL_PRESETS;

export function getSherpaModelOptions(modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}): SherpaTranscribeOptions {
    return {
        ...SHERPA_MODEL_PRESETS[modelId],
        ...overrides,
    };
}

const SHERPA_CDN_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models';

export const SHERPA_REMOTE_MODEL_FILES: Record<SherpaModelId, string[]> = {
    'streaming-zipformer-zh-int8-2025-06-30': ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'],
    'streaming-zipformer-en-2023-06-26': ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'],
    'streaming-zipformer-bilingual-zh-en-2023-02-20': ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'],
    'zipformer-en-2023-06-26': ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'],
    'zipformer-small-en-2023-06-26': ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'],
    'zipformer-zh-en-2023-11-22': ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'],
    'zipformer-ctc-zh-int8-2025-07-03': ['model.onnx', 'tokens.txt'],
};

type DownloadModelOptions = {
    baseUrl?: string;
    force?: boolean;
    onProgress?: (progress: { modelId: SherpaModelId; file: string; finished: number; total: number }) => void;
};

function ensureTrailingSlash(input: string): string {
    return input.endsWith('/') ? input : `${input}/`;
}

function ensureDocumentDirectory(): string {
    if (!FileSystem.documentDirectory) {
        throw new Error('expo-file-system documentDirectory is not available');
    }
    return ensureTrailingSlash(FileSystem.documentDirectory);
}

export function getDownloadedModelsRootDir(): string {
    return `${ensureDocumentDirectory()}sherpa/models/`;
}

export function getDownloadedModelDir(modelId: SherpaModelId): string {
    return `${getDownloadedModelsRootDir()}${modelId}/`;
}

export async function isModelDownloaded(modelId: SherpaModelId): Promise<boolean> {
    const files = SHERPA_REMOTE_MODEL_FILES[modelId];
    const modelDir = getDownloadedModelDir(modelId);
    for (const file of files) {
        const info = await FileSystem.getInfoAsync(`${modelDir}${file}`);
        if (!info.exists) {
            return false;
        }
    }
    return true;
}

export async function downloadModel(modelId: SherpaModelId, options: DownloadModelOptions = {}): Promise<string> {
    const files = SHERPA_REMOTE_MODEL_FILES[modelId];
    const modelDir = getDownloadedModelDir(modelId);
    const baseUrl = ensureTrailingSlash(options.baseUrl ?? SHERPA_CDN_BASE_URL);
    const modelBaseUrl = `${baseUrl}${modelId}/`;

    await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });

    let finished = 0;
    const total = files.length;
    for (const file of files) {
        const destination = `${modelDir}${file}`;
        const exists = await FileSystem.getInfoAsync(destination);

        if (!exists.exists || options.force) {
            const remoteUrl = `${modelBaseUrl}${file}`;
            console.log('@log', remoteUrl);
            await FileSystem.downloadAsync(remoteUrl, destination);
        }

        finished += 1;
        options.onProgress?.({ modelId, file, finished, total });
    }

    return modelDir;
}

export function getSherpaDownloadedModelOptions(modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}): SherpaTranscribeOptions {
    const { modelDirAsset: _ignoredModelDirAsset, ...presetWithoutAssetPath } = SHERPA_MODEL_PRESETS[modelId];
    return {
        ...presetWithoutAssetPath,
        modelDir: getDownloadedModelDir(modelId),
        ...overrides,
    };
}

const NativeSherpaOnnx = requireNativeModule<SherpaOnnxNative>('SherpaOnnx');

const SherpaOnnx = {
    ...NativeSherpaOnnx,
    transcribeWavByModel(path: string, modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}) {
        return NativeSherpaOnnx.transcribeWav(path, getSherpaModelOptions(modelId, overrides));
    },
    transcribeAssetWavByModel(assetPath: string, modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}) {
        return NativeSherpaOnnx.transcribeAssetWav(assetPath, getSherpaModelOptions(modelId, overrides));
    },
    downloadModel,
    isModelDownloaded,
    getDownloadedModelDir,
    transcribeWavByDownloadedModel(path: string, modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}) {
        return NativeSherpaOnnx.transcribeWav(path, getSherpaDownloadedModelOptions(modelId, overrides));
    },
    transcribeAssetWavByDownloadedModel(assetPath: string, modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}) {
        return NativeSherpaOnnx.transcribeAssetWav(assetPath, getSherpaDownloadedModelOptions(modelId, overrides));
    },
};

export default SherpaOnnx;
