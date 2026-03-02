import AsyncStorage from '@react-native-async-storage/async-storage';
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
    getFileSha256(filePath: string): Promise<{ size: number; sha256: string }>;
    unzipFile(zipPath: string, destDir: string): Promise<{ ok: boolean; destDir: string }>;
    copyAssetFile(assetPath: string, destPath: string): Promise<{ ok: boolean; destPath: string }>;
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
    onProgress?: (progress: DownloadModelProgress) => void;
};

type ModelPackageMeta = {
    size: number;
    sha256: string;
};

export type DownloadModelProgress = {
    modelId: SherpaModelId;
    phase: 'downloading-json' | 'downloading-zip' | 'verifying' | 'extracting' | 'ready';
    writtenBytes?: number;
    totalBytes?: number;
    percent?: number;
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

function getDownloadedPackagesRootDir(): string {
    return `${ensureDocumentDirectory()}sherpa/packages/`;
}

function getModelJsonPath(modelId: SherpaModelId): string {
    return `${getDownloadedPackagesRootDir()}${modelId}.json`;
}

function getModelZipPath(modelId: SherpaModelId): string {
    return `${getDownloadedPackagesRootDir()}${modelId}.zip`;
}

function getModelExtractTempDir(modelId: SherpaModelId): string {
    return `${getDownloadedModelsRootDir()}${modelId}.__tmp__/`;
}

function getResumeDataKey(modelId: SherpaModelId): string {
    return `sherpa:download:resume:${modelId}`;
}

async function safeDelete(uri: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
    }
}

async function removeModelPackageFiles(modelId: SherpaModelId): Promise<void> {
    await safeDelete(getModelZipPath(modelId));
    await safeDelete(getModelJsonPath(modelId));
}

function parseAndValidateMeta(content: string): ModelPackageMeta {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{')) {
        throw new Error(`Model meta is not JSON. First chars: ${trimmed.slice(0, 80)}`);
    }

    const parsed = JSON.parse(trimmed) as Partial<ModelPackageMeta>;
    if (typeof parsed.size !== 'number' || parsed.size < 0) {
        throw new Error('Invalid model meta: size');
    }
    if (typeof parsed.sha256 !== 'string' || parsed.sha256.length < 32) {
        throw new Error('Invalid model meta: sha256');
    }
    return {
        size: parsed.size,
        sha256: parsed.sha256.toLowerCase(),
    };
}

async function readLocalModelMeta(modelId: SherpaModelId): Promise<ModelPackageMeta | null> {
    const jsonPath = getModelJsonPath(modelId);
    const jsonInfo = await FileSystem.getInfoAsync(jsonPath);
    if (!jsonInfo.exists) {
        return null;
    }
    const content = await FileSystem.readAsStringAsync(jsonPath);
    return parseAndValidateMeta(content);
}

async function verifyZipByMeta(modelId: SherpaModelId, meta: ModelPackageMeta): Promise<boolean> {
    const zipPath = getModelZipPath(modelId);
    const zipInfo = await FileSystem.getInfoAsync(zipPath);
    if (!zipInfo.exists) {
        return false;
    }
    if (zipInfo.size !== meta.size) {
        return false;
    }
    const digest = await NativeSherpaOnnx.getFileSha256(zipPath);
    return digest.size === meta.size && digest.sha256.toLowerCase() === meta.sha256;
}

async function hasExtractedModelFiles(modelId: SherpaModelId): Promise<boolean> {
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

async function resolveExtractedSourceDir(tempDir: string, requiredFiles: string[]): Promise<string | null> {
    const inRoot = await Promise.all(requiredFiles.map(name => FileSystem.getInfoAsync(`${tempDir}${name}`)));
    if (inRoot.every(i => i.exists)) {
        return tempDir;
    }

    const entries = await FileSystem.readDirectoryAsync(tempDir);
    for (const name of entries) {
        const candidate = `${tempDir}${name}/`;
        const candidateInfo = await FileSystem.getInfoAsync(candidate);
        if (!candidateInfo.exists || !candidateInfo.isDirectory) {
            continue;
        }
        const found = await Promise.all(requiredFiles.map(f => FileSystem.getInfoAsync(`${candidate}${f}`)));
        if (found.every(i => i.exists)) {
            return candidate;
        }
    }
    return null;
}

async function extractModelZip(modelId: SherpaModelId): Promise<void> {
    const zipPath = getModelZipPath(modelId);
    const modelDir = getDownloadedModelDir(modelId);
    const tempDir = getModelExtractTempDir(modelId);
    const requiredFiles = SHERPA_REMOTE_MODEL_FILES[modelId];

    await safeDelete(tempDir);
    await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
    await NativeSherpaOnnx.unzipFile(zipPath, tempDir);

    const sourceDir = await resolveExtractedSourceDir(tempDir, requiredFiles);
    if (!sourceDir) {
        throw new Error(`Cannot find required model files after unzip: ${modelId}`);
    }

    await safeDelete(modelDir);
    await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });
    for (const file of requiredFiles) {
        await FileSystem.copyAsync({
            from: `${sourceDir}${file}`,
            to: `${modelDir}${file}`,
        });
    }
    await safeDelete(tempDir);
}

async function downloadModelMeta(
    modelId: SherpaModelId,
    baseUrl: string,
    onProgress?: (progress: DownloadModelProgress) => void,
): Promise<ModelPackageMeta> {
    const jsonUrl = `${baseUrl}${modelId}.json`;
    const jsonPath = getModelJsonPath(modelId);
    onProgress?.({ modelId, phase: 'downloading-json' });
    const result = await FileSystem.downloadAsync(jsonUrl, jsonPath);
    if (result.status && (result.status < 200 || result.status >= 300)) {
        throw new Error(`Failed to download model meta (${result.status}) from ${jsonUrl}`);
    }
    const content = await FileSystem.readAsStringAsync(jsonPath);
    try {
        return parseAndValidateMeta(content);
    } catch (error) {
        throw new Error(`Invalid model meta from ${jsonUrl}: ${(error as Error).message}`);
    }
}

async function downloadModelZipWithResume(
    modelId: SherpaModelId,
    baseUrl: string,
    onProgress?: (progress: DownloadModelProgress) => void,
): Promise<void> {
    const zipUrl = `${baseUrl}${modelId}.zip`;
    const zipPath = getModelZipPath(modelId);
    const resumeDataKey = getResumeDataKey(modelId);
    const resumeData = await AsyncStorage.getItem(resumeDataKey);

    const resumable = FileSystem.createDownloadResumable(
        zipUrl,
        zipPath,
        {},
        progress => {
            const total = progress.totalBytesExpectedToWrite;
            const written = progress.totalBytesWritten;
            const percent = total > 0 ? written / total : undefined;
            onProgress?.({
                modelId,
                phase: 'downloading-zip',
                writtenBytes: written,
                totalBytes: total > 0 ? total : undefined,
                percent,
            });
        },
        resumeData || undefined,
    );

    try {
        if (resumeData) {
            await resumable.resumeAsync();
        } else {
            await resumable.downloadAsync();
        }
        await AsyncStorage.removeItem(resumeDataKey);
    } catch (error) {
        const savable = resumable.savable();
        if (savable.resumeData) {
            await AsyncStorage.setItem(resumeDataKey, savable.resumeData);
        }
        throw error;
    }
}

export async function isModelDownloaded(modelId: SherpaModelId): Promise<boolean> {
    return hasExtractedModelFiles(modelId);
}

export async function downloadModel(modelId: SherpaModelId, options: DownloadModelOptions = {}): Promise<string> {
    const modelDir = getDownloadedModelDir(modelId);
    const packagesDir = getDownloadedPackagesRootDir();
    await FileSystem.makeDirectoryAsync(packagesDir, { intermediates: true });

    if (!options.force && (await hasExtractedModelFiles(modelId))) {
        options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
        return modelDir;
    }

    const baseUrl = ensureTrailingSlash(options.baseUrl ?? SHERPA_CDN_BASE_URL);
    let localMeta = await readLocalModelMeta(modelId);
    const localJsonExists = !!localMeta;
    const localZipExists = (await FileSystem.getInfoAsync(getModelZipPath(modelId))).exists;

    // Case 1: Local zip + json both exist -> verify integrity, then unzip or delete both.
    if (localJsonExists && localZipExists && localMeta) {
        options.onProgress?.({ modelId, phase: 'verifying' });
        const zipOk = await verifyZipByMeta(modelId, localMeta);
        if (zipOk) {
            options.onProgress?.({ modelId, phase: 'extracting' });
            await extractModelZip(modelId);
            await removeModelPackageFiles(modelId);
            options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
            return modelDir;
        }
        await safeDelete(getModelZipPath(modelId));
        await safeDelete(getModelJsonPath(modelId));
        localMeta = null;
    }

    // Case 3: No complete local package/extracted model -> download json + zip, then run Case 1 verification flow.
    if (!localMeta) {
        localMeta = await downloadModelMeta(modelId, baseUrl, options.onProgress);
    }

    // If local zip exists (but json may just be downloaded), verify first.
    // When it is valid, we can directly extract without re-downloading the zip.
    const zipExistsAfterMeta = (await FileSystem.getInfoAsync(getModelZipPath(modelId))).exists;
    if (zipExistsAfterMeta) {
        options.onProgress?.({ modelId, phase: 'verifying' });
        const localZipOk = await verifyZipByMeta(modelId, localMeta);
        if (localZipOk) {
            options.onProgress?.({ modelId, phase: 'extracting' });
            await extractModelZip(modelId);
            await removeModelPackageFiles(modelId);
            options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
            return modelDir;
        }
        await safeDelete(getModelZipPath(modelId));
        await safeDelete(getModelJsonPath(modelId));
        localMeta = await downloadModelMeta(modelId, baseUrl, options.onProgress);
    }

    await downloadModelZipWithResume(modelId, baseUrl, options.onProgress);

    options.onProgress?.({ modelId, phase: 'verifying' });
    const zipOkAfterDownload = await verifyZipByMeta(modelId, localMeta);
    if (!zipOkAfterDownload) {
        await safeDelete(getModelZipPath(modelId));
        await safeDelete(getModelJsonPath(modelId));
        throw new Error(`Downloaded zip integrity check failed for model: ${modelId}`);
    }

    options.onProgress?.({ modelId, phase: 'extracting' });
    await extractModelZip(modelId);
    await removeModelPackageFiles(modelId);
    options.onProgress?.({ modelId, phase: 'ready', percent: 1 });

    return modelDir;
}

export async function ensureModelReady(modelId: SherpaModelId, options: DownloadModelOptions = {}): Promise<string> {
    const modelDir = getDownloadedModelDir(modelId);
    if (options.force || !(await hasExtractedModelFiles(modelId))) {
        return downloadModel(modelId, options);
    }
    options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
    return modelDir;
}

type InitializeBundledModelOptions = {
    overwritePackage?: boolean;
    onProgress?: (progress: DownloadModelProgress) => void;
};

export async function initializeBundledModel(modelId: SherpaModelId, options: InitializeBundledModelOptions = {}): Promise<string> {
    const packageDir = getDownloadedPackagesRootDir();
    await FileSystem.makeDirectoryAsync(packageDir, { intermediates: true });

    const jsonPath = getModelJsonPath(modelId);
    const zipPath = getModelZipPath(modelId);
    const bundledJsonAssetPath = `sherpa/models/${modelId}.json`;
    const bundledZipAssetPath = `sherpa/models/${modelId}.zip`;

    const jsonExists = (await FileSystem.getInfoAsync(jsonPath)).exists;
    const zipExists = (await FileSystem.getInfoAsync(zipPath)).exists;
    const shouldOverwrite = options.overwritePackage === true;

    if (!jsonExists || shouldOverwrite) {
        options.onProgress?.({ modelId, phase: 'downloading-json' });
        await NativeSherpaOnnx.copyAssetFile(bundledJsonAssetPath, jsonPath);
    }
    if (!zipExists || shouldOverwrite) {
        options.onProgress?.({ modelId, phase: 'downloading-zip' });
        await NativeSherpaOnnx.copyAssetFile(bundledZipAssetPath, zipPath);
    }

    const meta = await readLocalModelMeta(modelId);
    if (!meta) {
        throw new Error(`Bundled model meta is missing or invalid for ${modelId}`);
    }

    options.onProgress?.({ modelId, phase: 'verifying' });
    const zipOk = await verifyZipByMeta(modelId, meta);
    if (!zipOk) {
        throw new Error(`Bundled model zip integrity check failed for ${modelId}`);
    }

    options.onProgress?.({ modelId, phase: 'extracting' });
    await extractModelZip(modelId);
    await removeModelPackageFiles(modelId);
    options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
    return getDownloadedModelDir(modelId);
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
    ensureModelReady,
    initializeBundledModel,
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
