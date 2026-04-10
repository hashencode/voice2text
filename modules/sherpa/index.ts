import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { requireNativeModule } from 'expo-modules-core';

export type SherpaTranscribeOptions = {
    modelDirAsset?: string;
    modelDir?: string;
    modelType?: 'paraformer' | 'moonshine';
    encoder?: string;
    model?: string;
    preprocessor?: string;
    uncachedDecoder?: string;
    cachedDecoder?: string;
    mergedDecoder?: string;
    temperature?: number;
    tokens?: string;
    sampleRate?: number;
    featureDim?: number;
    numThreads?: number;
    provider?: 'nnapi' | 'xnnpack' | 'cpu' | string;
    debug?: boolean;
    decodingMethod?: 'greedy_search' | 'modified_beam_search' | string;
    maxActivePaths?: number;
    blankPenalty?: number;
    enableDenoise?: boolean;
    denoiseModel?: string;
    enablePunctuation?: boolean;
    punctuationModel?: string;
    vadEngine?: 'tenvad' | 'silerovad' | string;
    vadModel?: string;
    vadThreshold?: number;
    vadMinSilenceDuration?: number;
    vadMinSpeechDuration?: number;
    vadWindowSize?: number;
    vadMaxSpeechDuration?: number;
    enableSpeakerDiarization?: boolean;
    speakerSegmentationModel?: string;
    speakerEmbeddingModel?: string;
    speakerMinDurationOn?: number;
    speakerMinDurationOff?: number;
    speakerNumClusters?: number;
    speakerClusteringThreshold?: number;
    speakerSimilarityThreshold?: number;
    wavReadMode?: 'streaming';
    streamingStartOffsetBytes?: number;
    streamingExistingText?: string;
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
    vadSegments?: {
        index: number;
        path: string;
        text: string;
        numSamples: number;
        durationMs: number;
    }[];
};

export type SherpaRuntimePathPrepareStep = {
    key: 'denoiseModel' | 'punctuationModel' | 'vadModel' | 'speakerSegmentationModel' | 'speakerEmbeddingModel';
    sourcePath: string;
    destinationPath: string;
    copied: boolean;
    elapsedMs: number;
    skipped: boolean;
    skipReason?: 'empty' | 'non_asset_path' | 'missing_file_name';
};

export type SherpaRuntimePathPrepareReport = {
    totalMs: number;
    steps: SherpaRuntimePathPrepareStep[];
};

export type SherpaDownloadedModelTranscribeTiming = {
    prepareRuntimePathsMs: number;
    nativeTranscribeMs: number;
    totalMs: number;
    provider: string;
    numThreads: number;
    availableProcessors: number;
    performanceTier: 'low' | 'high';
    runtimePathPrepare: SherpaRuntimePathPrepareReport;
};

export type SherpaDownloadedModelTranscribeWithTiming = {
    result: SherpaTranscribeResult;
    timing: SherpaDownloadedModelTranscribeTiming;
};

export type WavRecordingStartOptions = {
    path?: string;
    sampleRate?: number;
    chunkDurationMs?: number;
    realtimeMode?: 'official_simulated_vad' | 'disabled' | string;
    realtimeOptions?: SherpaTranscribeOptions;
};

export type WavRecordingStartResult = {
    path: string;
    sampleRate: number;
    sessionId?: string;
    chunkDurationMs?: number;
};

export type WavRecordingStopResult = {
    path: string;
    sampleRate: number;
    numSamples: number;
    sessionId?: string;
};

export type RecoveredWavRecording = {
    sessionId: string;
    path: string;
    sampleRate: number;
    numSamples: number;
    state: string;
    reason: string;
};

export type RecoverableWavRecording = {
    sessionId: string;
    outputPath: string;
    sampleRate: number;
    numSamples: number;
    numChunks: number;
    state: string;
    reason: string;
    startedAtMs: number;
};

export type DiscardRecoverableWavRecordingsResult = {
    deleted: number;
};

export type WavFileInfo = {
    sampleRate: number;
    numSamples: number;
    durationMs: number;
};

export type RealtimeAsrSnapshot = {
    active: boolean;
    mode: string;
    sampleRate: number;
    text: string;
    committedText: string;
    partialText: string;
    updatedAtMs: number;
};

export type SherpaRuntimeProfile = {
    availableProcessors: number;
    isLowRamDevice: boolean;
    recommendedNumThreads: number;
    performanceTier: 'low' | 'high';
};

export type SherpaProviderDiagnostics = {
    autoProviders: string[];
    nnapi: { supported: boolean; reason: string };
    xnnpack: { supported: boolean; reason: string };
};

export type SherpaProviderSelfCheck = {
    abi: string[];
    hardware: string;
    board: string;
    product: string;
    manufacturer: string;
    model: string;
    sdkInt: number;
    nativeLibDir: string;
    nativeLibDirReady: boolean;
    availableProviders: string[];
    libs: { name: string; exists: boolean }[];
};

export type SherpaAudioConvertOptions = {
    sampleRate?: number;
    bitRate?: number;
    channels?: number;
    sampleFormat?: 'u8' | 's16' | 's32' | 'flt' | 'dbl' | 'u8p' | 's16p' | 's32p' | 'fltp' | 'dblp' | string;
    codec?: string;
};

export type SherpaAudioOutputFormat = 'wav' | 'wav16k' | 'mp3' | 'flac' | 'm4a' | 'aac' | 'opus' | 'ogg' | 'oggm' | 'webm' | 'mkv';

export type SherpaDecodedAudio = {
    samples: number[];
    sampleRate: number;
};

export type SherpaAudioFileInfo = {
    sampleRate: number;
    channels: number;
    durationMs: number;
};

type SherpaOnnxNative = {
    hello(): string;
    getRuntimeProfile(): SherpaRuntimeProfile;
    getAutoProviders(): string[];
    getProviderDiagnostics(): SherpaProviderDiagnostics;
    getProviderSelfCheck(): SherpaProviderSelfCheck;
    isWavRecording(): boolean;
    isWavRecordingPaused(): boolean;
    startWavRecording(options?: WavRecordingStartOptions): Promise<WavRecordingStartResult>;
    stopWavRecording(): Promise<WavRecordingStopResult>;
    pauseWavRecording(): Promise<{ ok: boolean; paused: boolean }>;
    resumeWavRecording(): Promise<{ ok: boolean; paused: boolean }>;
    startRealtimeAsr(options?: SherpaTranscribeOptions & { realtimeMode?: string; sampleRate?: number }): Promise<{ ok: boolean }>;
    appendRealtimeAsrPcm(samples: number[], sampleRate?: number): Promise<{ ok: boolean }>;
    stopRealtimeAsr(): Promise<{ ok: boolean }>;
    getRealtimeAsrSnapshot(): RealtimeAsrSnapshot;
    recoverWavRecordings(): Promise<RecoveredWavRecording[]>;
    listRecoverableWavRecordings(): Promise<RecoverableWavRecording[]>;
    recoverWavRecordingSession(sessionId: string): Promise<RecoveredWavRecording | null>;
    discardRecoverableWavRecordings(sessionIds?: string[]): Promise<DiscardRecoverableWavRecordingsResult>;
    getWavInfo(path: string): Promise<WavFileInfo>;
    transcribeWav(path: string, options?: SherpaTranscribeOptions): Promise<SherpaTranscribeResult>;
    transcribeAssetWav(assetPath: string, options?: SherpaTranscribeOptions): Promise<SherpaTranscribeResult>;
    convertAudioToWav16k(inputPath: string, outputPath: string): Promise<{ ok: boolean; outputPath: string }>;
    convertAudioToFormat(
        inputPath: string,
        outputPath: string,
        format: SherpaAudioOutputFormat,
        options?: SherpaAudioConvertOptions,
    ): Promise<{
        ok: boolean;
        outputPath: string;
        format: SherpaAudioOutputFormat;
        sampleRate: number;
        bitRate: number;
        channels: number;
        sampleFormat: string;
        codec: string;
    }>;
    decodeAudioFileToFloatSamples(inputPath: string, targetSampleRateHz?: number): Promise<SherpaDecodedAudio>;
    getAudioFileInfo(inputPath: string): Promise<SherpaAudioFileInfo>;
    getFileSha256(filePath: string): Promise<{ size: number; sha256: string }>;
    unzipFile(zipPath: string, destDir: string): Promise<{ ok: boolean; destDir: string }>;
    copyAssetFile(assetPath: string, destPath: string): Promise<{ ok: boolean; destPath: string }>;
};

type SherpaModelPreset = SherpaTranscribeOptions & {
    requiredFiles: readonly string[];
};

type SherpaVadEngine = 'tenvad' | 'silerovad';

const DEFAULT_VAD_ENGINE: SherpaVadEngine = 'tenvad';
const AUTO_PROVIDER_ORDER = ['nnapi', 'xnnpack', 'cpu'] as const;
const FIXED_NUM_THREADS = 2;
const DEFAULT_RUNTIME_PROFILE: SherpaRuntimeProfile = {
    availableProcessors: 2,
    isLowRamDevice: false,
    recommendedNumThreads: FIXED_NUM_THREADS,
    performanceTier: 'low',
};

let hasLoggedProviderDiagnostics = false;
let hasLoggedProviderSelfCheck = false;

const VAD_ENGINE_DEFAULTS: Record<
    SherpaVadEngine,
    Pick<SherpaTranscribeOptions, 'vadEngine' | 'vadModel'> &
        Required<
            Pick<
                SherpaTranscribeOptions,
                'vadThreshold' | 'vadMinSilenceDuration' | 'vadMinSpeechDuration' | 'vadMaxSpeechDuration' | 'vadWindowSize'
            >
        >
> = {
    tenvad: {
        vadEngine: 'tenvad',
        vadModel: 'sherpa/onnx/ten-vad.onnx',
        vadThreshold: 0.4,
        vadMinSilenceDuration: 0.3,
        vadMinSpeechDuration: 0.25,
        vadMaxSpeechDuration: 6,
        vadWindowSize: 256,
    },
    silerovad: {
        vadEngine: 'silerovad',
        vadModel: 'sherpa/onnx/silero-vad.onnx',
        vadThreshold: 0.4,
        vadMinSilenceDuration: 0.3,
        vadMinSpeechDuration: 0.25,
        vadMaxSpeechDuration: 10,
        vadWindowSize: 512,
    },
};

function resolveVadEngine(value: unknown): SherpaVadEngine {
    if (value === 'silerovad' || value === 'tenvad') {
        return value;
    }
    return DEFAULT_VAD_ENGINE;
}

function withVadEngineDefaults(options: SherpaTranscribeOptions): SherpaTranscribeOptions {
    const vadEngine = resolveVadEngine(options.vadEngine);
    const defaults = VAD_ENGINE_DEFAULTS[vadEngine];
    const customVadModel = options.vadModel?.trim();
    const merged = {
        ...defaults,
        ...options,
    };
    return {
        ...merged,
        vadEngine,
        vadModel: customVadModel ? customVadModel : defaults.vadModel,
        vadThreshold: typeof merged.vadThreshold === 'number' ? merged.vadThreshold : defaults.vadThreshold,
        vadMinSilenceDuration:
            typeof merged.vadMinSilenceDuration === 'number' ? merged.vadMinSilenceDuration : defaults.vadMinSilenceDuration,
        vadMinSpeechDuration:
            typeof merged.vadMinSpeechDuration === 'number' ? merged.vadMinSpeechDuration : defaults.vadMinSpeechDuration,
        vadMaxSpeechDuration:
            typeof merged.vadMaxSpeechDuration === 'number' ? merged.vadMaxSpeechDuration : defaults.vadMaxSpeechDuration,
        vadWindowSize: typeof merged.vadWindowSize === 'number' ? merged.vadWindowSize : defaults.vadWindowSize,
    };
}

export const SHERPA_MODEL_PRESETS = {
    'moonshine-zh': {
        modelType: 'moonshine',
        modelDirAsset: 'sherpa/asr/moonshine-zh',
        enableDenoise: false,
        denoiseModel: 'sherpa/onnx/speech-enhancement.onnx',
        enablePunctuation: false,
        punctuationModel: 'sherpa/onnx/punctuation.onnx',
        encoder: 'encoder_model.ort',
        mergedDecoder: 'decoder_model_merged.ort',
        tokens: 'tokens.txt',
        requiredFiles: ['encoder_model.ort', 'decoder_model_merged.ort', 'tokens.txt'],
    },
    'paraformer-zh': {
        modelType: 'paraformer',
        modelDirAsset: 'sherpa/asr/paraformer-zh',
        enableDenoise: false,
        denoiseModel: 'sherpa/onnx/speech-enhancement.onnx',
        enablePunctuation: false,
        punctuationModel: 'sherpa/onnx/punctuation.onnx',
        model: 'model.int8.onnx',
        tokens: 'tokens.txt',
        requiredFiles: ['model.int8.onnx', 'tokens.txt'],
    },
} as const satisfies Record<string, SherpaModelPreset>;

export type SherpaModelId = keyof typeof SHERPA_MODEL_PRESETS;

const SHERPA_CDN_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models';
const ALLOWED_MODEL_DOWNLOAD_HOSTS = new Set(['pub-8a517913a3384e018c89aacd59a7b2db.r2.dev']);

type DownloadModelOptions = {
    baseUrl?: string;
    force?: boolean;
    onProgress?: (progress: DownloadModelProgress) => void;
};

type ImportModelZipForTestingOptions = {
    onProgress?: (progress: DownloadModelProgress) => void;
};

type ModelPackageMeta = {
    version: string;
    sha256: string;
    files: Record<string, string>;
};

type ExtractedModelValidation = {
    ok: boolean;
    issues: string[];
};

function isValidSha256(value: unknown): value is string {
    return typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
}

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

function ensureTrustedModelBaseUrl(rawUrl: string): string {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error(`Invalid model baseUrl: ${rawUrl}`);
    }
    if (parsed.protocol !== 'https:') {
        throw new Error(`Model baseUrl must use https: ${rawUrl}`);
    }
    if (!ALLOWED_MODEL_DOWNLOAD_HOSTS.has(parsed.host)) {
        throw new Error(`Model baseUrl host is not in allowlist: ${parsed.host}`);
    }
    return ensureTrailingSlash(parsed.toString());
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

function getResumeDataKey(modelId: SherpaModelId): string {
    return `sherpa:download:resume:${modelId}`;
}

function getModelExtractTempDir(modelId: SherpaModelId): string {
    return `${getDownloadedModelsRootDir()}${modelId}.__tmp__/`;
}

function getModelExtractStageDir(modelId: SherpaModelId): string {
    return `${getDownloadedModelsRootDir()}${modelId}.__stage__/`;
}

function getModelExtractingMarkerPath(modelId: SherpaModelId): string {
    return `${getDownloadedModelsRootDir()}${modelId}.__extracting__`;
}

function getModelDownloadingMarkerPath(modelId: SherpaModelId): string {
    return `${getDownloadedModelsRootDir()}${modelId}.__downloading__`;
}

function getInstalledModelMetaPath(modelId: SherpaModelId): string {
    return `${getDownloadedModelDir(modelId)}model.json`;
}

const modelOperationLocks = new Map<SherpaModelId, Promise<void>>();

async function withModelLock<T>(modelId: SherpaModelId, task: () => Promise<T>): Promise<T> {
    const previous = modelOperationLocks.get(modelId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
        release = resolve;
    });
    modelOperationLocks.set(
        modelId,
        previous.then(() => gate),
    );
    await previous;
    try {
        return await task();
    } finally {
        release();
    }
}

async function safeDelete(uri: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
    }
}

async function writeMarker(path: string, content: string): Promise<void> {
    await FileSystem.writeAsStringAsync(path, `${content}\n${new Date().toISOString()}`);
}

async function removeMarker(path: string): Promise<void> {
    await safeDelete(path);
}

async function validateRequiredFilesInDir(baseDir: string, requiredFiles: readonly string[]): Promise<ExtractedModelValidation> {
    const issues: string[] = [];
    for (const file of requiredFiles) {
        const filePath = `${baseDir}${file}`;
        const info = await FileSystem.getInfoAsync(filePath);
        if (!info.exists) {
            issues.push(`missing file: ${file}`);
            continue;
        }
        if (info.isDirectory) {
            issues.push(`expected file but got directory: ${file}`);
            continue;
        }
        if (typeof info.size !== 'number' || info.size <= 0) {
            issues.push(`empty or invalid size: ${file}`);
        }
    }
    return { ok: issues.length === 0, issues };
}

async function validateExtractedModelFiles(modelId: SherpaModelId): Promise<ExtractedModelValidation> {
    const modelDir = getDownloadedModelDir(modelId);
    const requiredFiles = SHERPA_MODEL_PRESETS[modelId].requiredFiles;
    const dirInfo = await FileSystem.getInfoAsync(modelDir);
    if (!dirInfo.exists || !dirInfo.isDirectory) {
        return { ok: false, issues: ['model directory is missing'] };
    }
    const requiredCheck = await validateRequiredFilesInDir(modelDir, requiredFiles);
    if (!requiredCheck.ok) {
        return requiredCheck;
    }

    const modelMetaPath = getInstalledModelMetaPath(modelId);
    const modelMetaInfo = await FileSystem.getInfoAsync(modelMetaPath);
    if (!modelMetaInfo.exists || modelMetaInfo.isDirectory || typeof modelMetaInfo.size !== 'number' || modelMetaInfo.size <= 0) {
        return { ok: false, issues: ['model.json is missing'] };
    }

    try {
        const content = await FileSystem.readAsStringAsync(modelMetaPath);
        parseAndValidateMeta(content);
    } catch (error) {
        return { ok: false, issues: [`model.json is invalid: ${(error as Error).message}`] };
    }

    console.info(`[sherpa] model.json exists, skip file sha validation: ${modelId}`);
    return { ok: true, issues: [] };
}

async function verifyExtractedModelHashes(modelId: SherpaModelId, meta: ModelPackageMeta): Promise<ExtractedModelValidation> {
    const modelDir = getDownloadedModelDir(modelId);
    const requiredFiles = SHERPA_MODEL_PRESETS[modelId].requiredFiles;
    const issues: string[] = [];

    for (const file of requiredFiles) {
        const expectedHash = meta.files[file]?.toLowerCase();
        if (!expectedHash) {
            issues.push(`meta.files is missing hash for ${file}`);
            continue;
        }
        const digest = await NativeSherpaOnnx.getFileSha256(`${modelDir}${file}`);
        if (digest.sha256.toLowerCase() !== expectedHash) {
            issues.push(`sha256 mismatch for ${file}`);
        }
    }
    return { ok: issues.length === 0, issues };
}

async function copyModelMetaToInstalledDir(modelId: SherpaModelId): Promise<void> {
    await FileSystem.copyAsync({
        from: getModelJsonPath(modelId),
        to: getInstalledModelMetaPath(modelId),
    });
}

async function recoverInterruptedState(modelId: SherpaModelId): Promise<void> {
    const extractingMarker = getModelExtractingMarkerPath(modelId);
    const downloadingMarker = getModelDownloadingMarkerPath(modelId);
    const tempDir = getModelExtractTempDir(modelId);
    const stageDir = getModelExtractStageDir(modelId);

    // Always cleanup stale extraction temp directories to avoid partial states.
    await safeDelete(tempDir);
    await safeDelete(stageDir);

    const extractingInfo = await FileSystem.getInfoAsync(extractingMarker);
    if (extractingInfo.exists) {
        await removeMarker(extractingMarker);
    }

    const downloadingInfo = await FileSystem.getInfoAsync(downloadingMarker);
    if (downloadingInfo.exists) {
        await removeMarker(downloadingMarker);
    }
}

async function removeModelPackageFiles(modelId: SherpaModelId): Promise<void> {
    await safeDelete(getModelZipPath(modelId));
    await safeDelete(getModelJsonPath(modelId));
    await AsyncStorage.removeItem(getResumeDataKey(modelId));
}

function parseAndValidateMeta(content: string): ModelPackageMeta {
    const trimmed = content.trim();
    if (!trimmed.startsWith('{')) {
        throw new Error(`Model meta is not JSON. First chars: ${trimmed.slice(0, 80)}`);
    }

    const parsed = JSON.parse(trimmed) as Partial<ModelPackageMeta>;
    if (typeof parsed.version !== 'string' || parsed.version.length === 0) {
        throw new Error('Invalid model meta: version');
    }
    if (!isValidSha256(parsed.sha256)) {
        throw new Error('Invalid model meta: sha256');
    }
    if (!parsed.files || typeof parsed.files !== 'object' || Array.isArray(parsed.files)) {
        throw new Error('Invalid model meta: files');
    }

    const normalizedFiles: Record<string, string> = {};
    for (const [name, hash] of Object.entries(parsed.files as Record<string, unknown>)) {
        if (!isValidSha256(hash)) {
            throw new Error(`Invalid model meta: files.${name}`);
        }
        normalizedFiles[name] = hash.toLowerCase();
    }

    return {
        version: parsed.version,
        sha256: parsed.sha256.toLowerCase(),
        files: normalizedFiles,
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
    const digest = await NativeSherpaOnnx.getFileSha256(zipPath);
    return digest.sha256.toLowerCase() === meta.sha256;
}

async function hasExtractedModelFiles(modelId: SherpaModelId): Promise<boolean> {
    const check = await validateExtractedModelFiles(modelId);
    return check.ok;
}

async function resolveExtractedSourceDir(tempDir: string, requiredFiles: readonly string[]): Promise<string | null> {
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

async function extractModelZip(modelId: SherpaModelId, meta: ModelPackageMeta): Promise<void> {
    const zipPath = getModelZipPath(modelId);
    const modelDir = getDownloadedModelDir(modelId);
    const tempDir = getModelExtractTempDir(modelId);
    const stageDir = getModelExtractStageDir(modelId);
    const extractingMarker = getModelExtractingMarkerPath(modelId);
    const requiredFiles = SHERPA_MODEL_PRESETS[modelId].requiredFiles;

    await writeMarker(extractingMarker, `extracting:${modelId}`);
    try {
        await safeDelete(tempDir);
        await safeDelete(stageDir);
        await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
        await NativeSherpaOnnx.unzipFile(zipPath, tempDir);

        const sourceDir = await resolveExtractedSourceDir(tempDir, requiredFiles);
        if (!sourceDir) {
            throw new Error(`Cannot find required model files after unzip: ${modelId}`);
        }

        await FileSystem.makeDirectoryAsync(stageDir, { intermediates: true });
        for (const file of requiredFiles) {
            await FileSystem.copyAsync({
                from: `${sourceDir}${file}`,
                to: `${stageDir}${file}`,
            });
        }

        const stageCheck = await validateRequiredFilesInDir(stageDir, requiredFiles);
        if (!stageCheck.ok) {
            throw new Error(`Extracted model validation failed for ${modelId}: ${stageCheck.issues.join('; ')}`);
        }

        await safeDelete(modelDir);
        await FileSystem.moveAsync({
            from: stageDir,
            to: modelDir,
        });

        const finalRequiredCheck = await validateRequiredFilesInDir(modelDir, requiredFiles);
        if (!finalRequiredCheck.ok) {
            throw new Error(`Model files are invalid after move for ${modelId}: ${finalRequiredCheck.issues.join('; ')}`);
        }

        const hashCheck = await verifyExtractedModelHashes(modelId, meta);
        if (!hashCheck.ok) {
            throw new Error(`Model files sha256 validation failed for ${modelId}: ${hashCheck.issues.join('; ')}`);
        }
        await copyModelMetaToInstalledDir(modelId);
    } finally {
        await safeDelete(tempDir);
        await safeDelete(stageDir);
        await removeMarker(extractingMarker);
    }
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
    const downloadingMarker = getModelDownloadingMarkerPath(modelId);
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

    await writeMarker(downloadingMarker, `downloading:${modelId}`);
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
        } else {
            await AsyncStorage.removeItem(resumeDataKey);
        }
        throw error;
    } finally {
        await removeMarker(downloadingMarker);
    }
}

export async function isModelDownloaded(modelId: SherpaModelId): Promise<boolean> {
    return hasExtractedModelFiles(modelId);
}

export async function getInstalledModelVersion(modelId: SherpaModelId): Promise<string | null> {
    const modelMetaPath = getInstalledModelMetaPath(modelId);
    const info = await FileSystem.getInfoAsync(modelMetaPath);
    if (!info.exists || info.isDirectory) {
        return null;
    }
    try {
        const content = await FileSystem.readAsStringAsync(modelMetaPath);
        const meta = parseAndValidateMeta(content);
        return meta.version;
    } catch (error) {
        console.warn(`[sherpa] installed model meta is invalid: ${modelId}`, error);
        return null;
    }
}

export async function uninstallModel(modelId: SherpaModelId): Promise<void> {
    await withModelLock(modelId, async () => {
        await recoverInterruptedState(modelId);
        await safeDelete(getDownloadedModelDir(modelId));
        await removeModelPackageFiles(modelId);
    });
}

export async function listLocalModels(): Promise<SherpaModelId[]> {
    const modelIds = Object.keys(SHERPA_MODEL_PRESETS) as SherpaModelId[];
    const existing: SherpaModelId[] = [];
    for (const modelId of modelIds) {
        if (await hasExtractedModelFiles(modelId)) {
            existing.push(modelId);
        }
    }
    return existing;
}

export async function downloadModel(modelId: SherpaModelId, options: DownloadModelOptions = {}): Promise<string> {
    return withModelLock(modelId, async () => {
        const modelDir = getDownloadedModelDir(modelId);
        const packagesDir = getDownloadedPackagesRootDir();
        console.info(`[sherpa] [step 3] checking private package cache: ${modelId}`);
        await FileSystem.makeDirectoryAsync(packagesDir, { intermediates: true });
        await FileSystem.makeDirectoryAsync(getDownloadedModelsRootDir(), { intermediates: true });
        await recoverInterruptedState(modelId);

        if (!options.force) {
            const extractedCheck = await validateExtractedModelFiles(modelId);
            if (extractedCheck.ok) {
                console.info(`[sherpa] model already ready, skip download: ${modelId}`);
                await removeModelPackageFiles(modelId);
                options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
                return modelDir;
            }
        }

        const baseUrl = ensureTrustedModelBaseUrl(options.baseUrl ?? SHERPA_CDN_BASE_URL);
        let localMeta = await readLocalModelMeta(modelId);
        const localZipExists = (await FileSystem.getInfoAsync(getModelZipPath(modelId))).exists;

        if (localMeta && localZipExists) {
            console.info(`[sherpa] [step 3] private package cache hit: ${modelId}`);
            options.onProgress?.({ modelId, phase: 'verifying' });
            const zipOk = await verifyZipByMeta(modelId, localMeta);
            if (zipOk) {
                console.info(`[sherpa] local package hit, extracting directly: ${modelId}`);
                options.onProgress?.({ modelId, phase: 'extracting' });
                await extractModelZip(modelId, localMeta);
                await removeModelPackageFiles(modelId);
                options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
                return modelDir;
            }
            console.warn(`[sherpa] local package verification failed, falling back to remote download: ${modelId}`);
            await removeModelPackageFiles(modelId);
            localMeta = null;
        } else {
            console.info(`[sherpa] [step 3] private package cache miss: ${modelId}`);
        }

        if (!localMeta) {
            console.info(`[sherpa] [step 4] downloading meta from remote: ${modelId}`);
            localMeta = await downloadModelMeta(modelId, baseUrl, options.onProgress);
        }

        const zipExistsAfterMeta = (await FileSystem.getInfoAsync(getModelZipPath(modelId))).exists;
        if (!zipExistsAfterMeta) {
            console.info(`[sherpa] [step 4] downloading zip from remote: ${modelId}`);
            await downloadModelZipWithResume(modelId, baseUrl, options.onProgress);
        } else {
            console.info(`[sherpa] [step 3] using cached zip in private packages: ${modelId}`);
        }

        options.onProgress?.({ modelId, phase: 'verifying' });
        const zipOk = await verifyZipByMeta(modelId, localMeta);
        if (!zipOk) {
            console.warn(`[sherpa] downloaded package verification failed, cleaning local package and retry required: ${modelId}`);
            await removeModelPackageFiles(modelId);
            throw new Error(`Downloaded zip integrity check failed for model: ${modelId}`);
        }

        options.onProgress?.({ modelId, phase: 'extracting' });
        await extractModelZip(modelId, localMeta);
        await removeModelPackageFiles(modelId);
        options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
        return modelDir;
    });
}

export async function ensureModelReady(modelId: SherpaModelId, options: DownloadModelOptions = {}): Promise<string> {
    const modelDir = getDownloadedModelDir(modelId);
    console.info(`[sherpa] [step 1] checking extracted model dir: ${modelId}`);
    const extractedCheck = await validateExtractedModelFiles(modelId);

    if (!options.force && extractedCheck.ok) {
        console.info(`[sherpa] [step 1] extracted model dir hit, ready: ${modelId}`);
        await removeModelPackageFiles(modelId);
        options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
        return modelDir;
    }
    console.info(`[sherpa] [step 1] extracted model dir miss: ${modelId}`);

    if (!options.force) {
        const hasZip = (await FileSystem.getInfoAsync(getModelZipPath(modelId))).exists;
        const hasJson = (await FileSystem.getInfoAsync(getModelJsonPath(modelId))).exists;
        if (!hasZip && !hasJson && (await FileSystem.getInfoAsync(modelDir)).exists) {
            throw new Error(`Model files are invalid for ${modelId}: ${extractedCheck.issues.join('; ')}`);
        }

        // Prefer bundled assets first. If bundled files are absent, fall back to remote download.
        console.info(`[sherpa] [step 2] checking bundled assets in assets/sherpa/asr: ${modelId}`);
        try {
            return await initializeBundledModel(modelId, {
                onProgress: options.onProgress,
            });
        } catch (error) {
            const message = (error as Error)?.message ?? String(error);
            const isBundledAssetMissing =
                message.includes('Asset not found') ||
                message.includes('ERR_SHERPA_COPY_ASSET_FILE') ||
                message.includes('Bundled model meta is missing or invalid');
            if (!isBundledAssetMissing) {
                console.warn(`[sherpa] [step 2] bundled assets found but init failed, fallback to step 3/4: ${modelId}`, error);
            } else {
                console.info(`[sherpa] [step 2] bundled assets miss, continue to step 3/4: ${modelId}`);
            }
        }
    }

    console.info(`[sherpa] continue with [step 3 -> step 4] flow: ${modelId}`);
    return downloadModel(modelId, options);
}

export async function importModelZipForTesting(
    modelId: SherpaModelId,
    zipFileUri: string,
    options: ImportModelZipForTestingOptions = {},
): Promise<string> {
    return withModelLock(modelId, async () => {
        const inputUri = zipFileUri.trim();
        if (!inputUri) {
            throw new Error('Local zip path is empty');
        }

        const modelDir = getDownloadedModelDir(modelId);
        const tempDir = getModelExtractTempDir(modelId);
        const stageDir = getModelExtractStageDir(modelId);
        const importsDir = `${ensureDocumentDirectory()}sherpa/imports/`;
        const importedZipPath = `${importsDir}${modelId}.zip`;
        const requiredFiles = SHERPA_MODEL_PRESETS[modelId].requiredFiles;

        await FileSystem.makeDirectoryAsync(getDownloadedModelsRootDir(), { intermediates: true });
        await FileSystem.makeDirectoryAsync(importsDir, { intermediates: true });
        await recoverInterruptedState(modelId);

        options.onProgress?.({ modelId, phase: 'downloading-zip' });
        await safeDelete(importedZipPath);
        await FileSystem.copyAsync({
            from: inputUri,
            to: importedZipPath,
        });
        const zipInfo = await FileSystem.getInfoAsync(importedZipPath);
        if (!zipInfo.exists || zipInfo.isDirectory || typeof zipInfo.size !== 'number' || zipInfo.size <= 0) {
            throw new Error(`Imported zip is invalid for model: ${modelId}`);
        }

        options.onProgress?.({ modelId, phase: 'extracting' });
        await safeDelete(tempDir);
        await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
        const unzipResult = await NativeSherpaOnnx.unzipFile(importedZipPath, tempDir);
        if (!unzipResult.ok) {
            throw new Error(`Unzip failed for model: ${modelId}`);
        }

        const sourceDir = await resolveExtractedSourceDir(tempDir, requiredFiles);
        if (!sourceDir) {
            throw new Error(`Imported zip missing required files for ${modelId}: ${requiredFiles.join(', ')}`);
        }

        await safeDelete(stageDir);
        await FileSystem.makeDirectoryAsync(stageDir, { intermediates: true });
        for (const file of requiredFiles) {
            const from = `${sourceDir}${file}`;
            const to = `${stageDir}${file}`;
            const parent = to.split('/').slice(0, -1).join('/') + '/';
            await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
            await FileSystem.copyAsync({ from, to });
        }

        // This testing-only import intentionally skips remote model json verification.
        // We still persist a minimal valid metadata file so existing installed-version
        // queries and "is installed" checks can work consistently.
        const fakeMeta: ModelPackageMeta = {
            version: 'local-import-test',
            sha256: '0'.repeat(64),
            files: {},
        };
        await FileSystem.writeAsStringAsync(`${stageDir}model.json`, JSON.stringify(fakeMeta, null, 2));

        await safeDelete(modelDir);
        await FileSystem.moveAsync({ from: stageDir, to: modelDir });
        await safeDelete(tempDir);
        await safeDelete(importedZipPath);
        await removeModelPackageFiles(modelId);
        options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
        return modelDir;
    });
}

type InitializeBundledModelOptions = {
    overwritePackage?: boolean;
    onProgress?: (progress: DownloadModelProgress) => void;
};

export async function initializeBundledModel(modelId: SherpaModelId, options: InitializeBundledModelOptions = {}): Promise<string> {
    return withModelLock(modelId, async () => {
        const modelDir = getDownloadedModelDir(modelId);
        await FileSystem.makeDirectoryAsync(getDownloadedPackagesRootDir(), { intermediates: true });
        await FileSystem.makeDirectoryAsync(getDownloadedModelsRootDir(), { intermediates: true });
        await recoverInterruptedState(modelId);

        if (!options.overwritePackage) {
            const extractedCheck = await validateExtractedModelFiles(modelId);
            if (extractedCheck.ok) {
                console.info(`[sherpa] model already ready, skip bundled extract: ${modelId}`);
                await removeModelPackageFiles(modelId);
                options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
                return modelDir;
            }
        }

        const jsonPath = getModelJsonPath(modelId);
        const zipPath = getModelZipPath(modelId);
        const bundledJsonAssetPath = `sherpa/asr/${modelId}.json`;
        const bundledZipAssetPath = `sherpa/asr/${modelId}.zip`;
        const shouldOverwrite = options.overwritePackage === true;

        if (!(await FileSystem.getInfoAsync(jsonPath)).exists || shouldOverwrite) {
            options.onProgress?.({ modelId, phase: 'downloading-json' });
            await NativeSherpaOnnx.copyAssetFile(bundledJsonAssetPath, jsonPath);
        }
        if (!(await FileSystem.getInfoAsync(zipPath)).exists || shouldOverwrite) {
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
        await extractModelZip(modelId, meta);
        await removeModelPackageFiles(modelId);
        options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
        return modelDir;
    });
}

export function getSherpaDownloadedModelOptions(modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}): SherpaTranscribeOptions {
    const {
        modelDirAsset: _ignoredModelDirAsset,
        requiredFiles: _ignoredRequiredFiles,
        ...presetWithoutAssetPath
    } = SHERPA_MODEL_PRESETS[modelId];
    return withVadEngineDefaults({
        ...presetWithoutAssetPath,
        modelDir: getDownloadedModelDir(modelId),
        ...overrides,
    });
}

async function ensureDownloadedAuxModelPath(
    options: SherpaTranscribeOptions,
    key: 'denoiseModel' | 'punctuationModel' | 'vadModel' | 'speakerSegmentationModel' | 'speakerEmbeddingModel',
    subDir: string,
): Promise<SherpaTranscribeOptions> {
    const modelPath = options[key]?.trim();
    if (!modelPath) {
        return options;
    }

    const isAssetPath = modelPath.startsWith('sherpa/') || modelPath.startsWith('models/');
    if (!isAssetPath) {
        return options;
    }

    const fileName = modelPath.split('/').filter(Boolean).pop();
    if (!fileName) {
        return options;
    }

    const rootDir = `${ensureDocumentDirectory()}sherpa/${subDir}/`;
    const destPath = `${rootDir}${fileName}`;
    await FileSystem.makeDirectoryAsync(rootDir, { intermediates: true });
    const info = await FileSystem.getInfoAsync(destPath);
    if (!info.exists || info.isDirectory || typeof info.size !== 'number' || info.size <= 0) {
        await NativeSherpaOnnx.copyAssetFile(modelPath, destPath);
    }

    return {
        ...options,
        [key]: destPath,
    };
}

async function ensureDownloadedAuxModelPathWithReport(
    options: SherpaTranscribeOptions,
    key: 'denoiseModel' | 'punctuationModel' | 'vadModel' | 'speakerSegmentationModel' | 'speakerEmbeddingModel',
    subDir: string,
): Promise<{ options: SherpaTranscribeOptions; step: SherpaRuntimePathPrepareStep | null }> {
    const startedAt = Date.now();
    const modelPath = options[key]?.trim();
    if (!modelPath) {
        return {
            options,
            step: {
                key,
                sourcePath: '',
                destinationPath: '',
                copied: false,
                elapsedMs: Date.now() - startedAt,
                skipped: true,
                skipReason: 'empty',
            },
        };
    }

    const isAssetPath = modelPath.startsWith('sherpa/') || modelPath.startsWith('models/');
    if (!isAssetPath) {
        return {
            options,
            step: {
                key,
                sourcePath: modelPath,
                destinationPath: modelPath,
                copied: false,
                elapsedMs: Date.now() - startedAt,
                skipped: true,
                skipReason: 'non_asset_path',
            },
        };
    }

    const fileName = modelPath.split('/').filter(Boolean).pop();
    if (!fileName) {
        return {
            options,
            step: {
                key,
                sourcePath: modelPath,
                destinationPath: '',
                copied: false,
                elapsedMs: Date.now() - startedAt,
                skipped: true,
                skipReason: 'missing_file_name',
            },
        };
    }

    const rootDir = `${ensureDocumentDirectory()}sherpa/${subDir}/`;
    const destPath = `${rootDir}${fileName}`;
    await FileSystem.makeDirectoryAsync(rootDir, { intermediates: true });
    const info = await FileSystem.getInfoAsync(destPath);
    let copied = false;
    if (!info.exists || info.isDirectory || typeof info.size !== 'number' || info.size <= 0) {
        await NativeSherpaOnnx.copyAssetFile(modelPath, destPath);
        copied = true;
    }

    return {
        options: {
            ...options,
            [key]: destPath,
        },
        step: {
            key,
            sourcePath: modelPath,
            destinationPath: destPath,
            copied,
            elapsedMs: Date.now() - startedAt,
            skipped: false,
        },
    };
}

async function ensureDownloadedRuntimeModelPaths(options: SherpaTranscribeOptions): Promise<SherpaTranscribeOptions> {
    let resolved = await ensureDownloadedAuxModelPath(options, 'denoiseModel', 'speech-enhancement');
    resolved = await ensureDownloadedAuxModelPath(resolved, 'punctuationModel', 'punctuation');
    resolved = await ensureDownloadedAuxModelPath(resolved, 'vadModel', 'vad');
    resolved = await ensureDownloadedAuxModelPath(resolved, 'speakerSegmentationModel', 'speaker-diarization');
    resolved = await ensureDownloadedAuxModelPath(resolved, 'speakerEmbeddingModel', 'speaker-recognition');
    return resolved;
}

async function ensureDownloadedRuntimeModelPathsWithReport(
    options: SherpaTranscribeOptions,
): Promise<{ options: SherpaTranscribeOptions; report: SherpaRuntimePathPrepareReport }> {
    const totalStartedAt = Date.now();
    const steps: SherpaRuntimePathPrepareStep[] = [];
    let resolved = options;

    const denoise = await ensureDownloadedAuxModelPathWithReport(resolved, 'denoiseModel', 'speech-enhancement');
    resolved = denoise.options;
    if (denoise.step) {
        steps.push(denoise.step);
    }

    const punctuation = await ensureDownloadedAuxModelPathWithReport(resolved, 'punctuationModel', 'punctuation');
    resolved = punctuation.options;
    if (punctuation.step) {
        steps.push(punctuation.step);
    }

    const vad = await ensureDownloadedAuxModelPathWithReport(resolved, 'vadModel', 'vad');
    resolved = vad.options;
    if (vad.step) {
        steps.push(vad.step);
    }

    const speakerSegmentation = await ensureDownloadedAuxModelPathWithReport(resolved, 'speakerSegmentationModel', 'speaker-diarization');
    resolved = speakerSegmentation.options;
    if (speakerSegmentation.step) {
        steps.push(speakerSegmentation.step);
    }

    const speakerEmbedding = await ensureDownloadedAuxModelPathWithReport(resolved, 'speakerEmbeddingModel', 'speaker-recognition');
    resolved = speakerEmbedding.options;
    if (speakerEmbedding.step) {
        steps.push(speakerEmbedding.step);
    }

    return {
        options: resolved,
        report: {
            totalMs: Date.now() - totalStartedAt,
            steps,
        },
    };
}

function normalizeProvider(provider?: string): string | null {
    const normalized = provider?.trim().toLowerCase();
    return normalized ? normalized : null;
}

function getSafeProviderDiagnostics(): SherpaProviderDiagnostics | null {
    try {
        return NativeSherpaOnnx.getProviderDiagnostics();
    } catch {
        return null;
    }
}

function getSafeProviderSelfCheck(): SherpaProviderSelfCheck | null {
    try {
        return NativeSherpaOnnx.getProviderSelfCheck();
    } catch {
        return null;
    }
}

function buildProviderCandidates(explicitProvider?: string, modelType?: string): string[] {
    const normalized = normalizeProvider(explicitProvider);
    if (normalized) {
        return [normalized];
    }
    const diagnostics = getSafeProviderDiagnostics();
    if (diagnostics && diagnostics.autoProviders.length > 0) {
        return diagnostics.autoProviders.map(item => normalizeProvider(item)).filter((item): item is string => Boolean(item));
    }
    try {
        const nativeProviders = NativeSherpaOnnx.getAutoProviders();
        const normalizedProviders = nativeProviders.map(item => normalizeProvider(item)).filter((item): item is string => Boolean(item));
        if (normalizedProviders.length > 0) {
            return normalizedProviders;
        }
    } catch {
        // ignore and fallback to JS defaults
    }
    return [...AUTO_PROVIDER_ORDER];
}

function getSafeRuntimeProfile(): SherpaRuntimeProfile {
    try {
        const profile = NativeSherpaOnnx.getRuntimeProfile();
        return {
            availableProcessors: Math.max(1, Math.round(profile.availableProcessors || DEFAULT_RUNTIME_PROFILE.availableProcessors)),
            isLowRamDevice: Boolean(profile.isLowRamDevice),
            recommendedNumThreads: FIXED_NUM_THREADS,
            performanceTier: 'low',
        };
    } catch {
        return DEFAULT_RUNTIME_PROFILE;
    }
}

function normalizeNumThreads(value: number): number {
    void value;
    return FIXED_NUM_THREADS;
}

async function transcribeWavWithAutoProvider(
    path: string,
    baseOptions: SherpaTranscribeOptions,
): Promise<{ result: SherpaTranscribeResult; provider: string; numThreads: number; runtimeProfile: SherpaRuntimeProfile }> {
    const runtimeProfile = getSafeRuntimeProfile();
    const diagnostics = getSafeProviderDiagnostics();
    const selfCheck = getSafeProviderSelfCheck();
    if (!hasLoggedProviderSelfCheck && selfCheck) {
        hasLoggedProviderSelfCheck = true;
        const missingLibs = selfCheck.libs.filter(item => !item.exists).map(item => item.name);
        console.info(
            `[sherpa][provider-self-check] abi=${selfCheck.abi.join(',')} device=${selfCheck.manufacturer} ${selfCheck.model} sdk=${selfCheck.sdkInt} hw=${selfCheck.hardware}/${selfCheck.board}/${selfCheck.product} nativeLibDirReady=${selfCheck.nativeLibDirReady} availableProviders=${selfCheck.availableProviders.join(',') || 'none'} missingLibs=${missingLibs.join(',') || 'none'}`,
        );
    }
    if (!hasLoggedProviderDiagnostics && diagnostics) {
        hasLoggedProviderDiagnostics = true;
        const unsupportedReasons = [
            diagnostics.nnapi.supported ? null : `nnapi: ${diagnostics.nnapi.reason}`,
            diagnostics.xnnpack.supported ? null : `xnnpack: ${diagnostics.xnnpack.reason}`,
        ].filter((item): item is string => Boolean(item));
        if (unsupportedReasons.length > 0) {
            console.info(
                `[sherpa][provider-diagnostics] autoProviders=${diagnostics.autoProviders.join(',')} unsupported=${unsupportedReasons.join(' | ')}`,
            );
        } else {
            console.info(`[sherpa][provider-diagnostics] autoProviders=${diagnostics.autoProviders.join(',')} all-accelerators-supported`);
        }
    }
    const explicitProvider = normalizeProvider(baseOptions.provider);
    if (typeof baseOptions.numThreads === 'number') {
        normalizeNumThreads(baseOptions.numThreads);
    }
    const providerCandidates = buildProviderCandidates(explicitProvider ?? undefined, baseOptions.modelType);
    let lastError: unknown = null;

    for (let index = 0; index < providerCandidates.length; index += 1) {
        const provider = providerCandidates[index];
        const options = {
            ...baseOptions,
            provider,
            numThreads: FIXED_NUM_THREADS,
        };
        try {
            const result = await NativeSherpaOnnx.transcribeWav(path, options);
            return {
                result,
                provider,
                numThreads: FIXED_NUM_THREADS,
                runtimeProfile,
            };
        } catch (error) {
            lastError = error;
            const hasNext = index < providerCandidates.length - 1;
            if (!hasNext || explicitProvider !== null) {
                throw error;
            }
        }
    }

    throw lastError as Error;
}

const NativeSherpaOnnx = requireNativeModule<SherpaOnnxNative>('SherpaOnnx');

const SherpaOnnx = {
    hello: NativeSherpaOnnx.hello,
    getRuntimeProfile: NativeSherpaOnnx.getRuntimeProfile,
    getAutoProviders: NativeSherpaOnnx.getAutoProviders,
    getProviderDiagnostics: NativeSherpaOnnx.getProviderDiagnostics,
    getProviderSelfCheck: NativeSherpaOnnx.getProviderSelfCheck,
    isWavRecording: NativeSherpaOnnx.isWavRecording,
    isWavRecordingPaused: NativeSherpaOnnx.isWavRecordingPaused,
    startWavRecording: NativeSherpaOnnx.startWavRecording,
    stopWavRecording: NativeSherpaOnnx.stopWavRecording,
    pauseWavRecording: NativeSherpaOnnx.pauseWavRecording,
    resumeWavRecording: NativeSherpaOnnx.resumeWavRecording,
    startRealtimeAsr: NativeSherpaOnnx.startRealtimeAsr,
    appendRealtimeAsrPcm: NativeSherpaOnnx.appendRealtimeAsrPcm,
    stopRealtimeAsr: NativeSherpaOnnx.stopRealtimeAsr,
    getRealtimeAsrSnapshot: NativeSherpaOnnx.getRealtimeAsrSnapshot,
    recoverWavRecordings: NativeSherpaOnnx.recoverWavRecordings,
    listRecoverableWavRecordings: NativeSherpaOnnx.listRecoverableWavRecordings,
    recoverWavRecordingSession: NativeSherpaOnnx.recoverWavRecordingSession,
    discardRecoverableWavRecordings: NativeSherpaOnnx.discardRecoverableWavRecordings,
    getWavInfo: NativeSherpaOnnx.getWavInfo,
    transcribeWav: NativeSherpaOnnx.transcribeWav,
    transcribeAssetWav: NativeSherpaOnnx.transcribeAssetWav,
    convertAudioToWav16k: NativeSherpaOnnx.convertAudioToWav16k,
    convertAudioToFormat: NativeSherpaOnnx.convertAudioToFormat,
    decodeAudioFileToFloatSamples: NativeSherpaOnnx.decodeAudioFileToFloatSamples,
    getAudioFileInfo: NativeSherpaOnnx.getAudioFileInfo,
    getFileSha256: NativeSherpaOnnx.getFileSha256,
    unzipFile: NativeSherpaOnnx.unzipFile,
    copyAssetFile: NativeSherpaOnnx.copyAssetFile,
    downloadModel,
    ensureModelReady,
    async prepareRuntimeTranscribeOptions(options: SherpaTranscribeOptions): Promise<SherpaTranscribeOptions> {
        return ensureDownloadedRuntimeModelPaths(options);
    },
    initializeBundledModel,
    importModelZipForTesting,
    isModelDownloaded,
    getInstalledModelVersion,
    listLocalModels,
    uninstallModel,
    getDownloadedModelDir,
    async transcribeWavByDownloadedModel(path: string, modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}) {
        const options = await ensureDownloadedRuntimeModelPaths(getSherpaDownloadedModelOptions(modelId, overrides));
        const transcribed = await transcribeWavWithAutoProvider(path, options);
        return transcribed.result;
    },
    async transcribeWavByDownloadedModelWithTiming(
        path: string,
        modelId: SherpaModelId,
        overrides: SherpaTranscribeOptions = {},
    ): Promise<SherpaDownloadedModelTranscribeWithTiming> {
        const totalStartedAt = Date.now();
        const prepareStartedAt = Date.now();
        const prepared = await ensureDownloadedRuntimeModelPathsWithReport(getSherpaDownloadedModelOptions(modelId, overrides));
        const prepareRuntimePathsMs = Date.now() - prepareStartedAt;
        const nativeStartedAt = Date.now();
        const transcribed = await transcribeWavWithAutoProvider(path, prepared.options);
        const nativeTranscribeMs = Date.now() - nativeStartedAt;
        const totalMs = Date.now() - totalStartedAt;
        return {
            result: transcribed.result,
            timing: {
                prepareRuntimePathsMs,
                nativeTranscribeMs,
                totalMs,
                provider: transcribed.provider,
                numThreads: transcribed.numThreads,
                availableProcessors: transcribed.runtimeProfile.availableProcessors,
                performanceTier: transcribed.runtimeProfile.performanceTier,
                runtimePathPrepare: prepared.report,
            },
        };
    },
};

export default SherpaOnnx;
