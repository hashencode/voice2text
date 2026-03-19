import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { requireNativeModule } from 'expo-modules-core';

export type SherpaTranscribeOptions = {
    modelDirAsset?: string;
    modelDir?: string;
    modelType?: 'transducer' | 'moonshine' | 'funasr_nano' | string;
    encoder?: string;
    decoder?: string;
    joiner?: string;
    model?: string;
    preprocessor?: string;
    uncachedDecoder?: string;
    cachedDecoder?: string;
    mergedDecoder?: string;
    encoderAdaptor?: string;
    llm?: string;
    embedding?: string;
    tokenizer?: string;
    tokens?: string;
    sampleRate?: number;
    featureDim?: number;
    numThreads?: number;
    provider?: 'cpu' | 'xnnpack' | string;
    debug?: boolean;
    decodingMethod?: 'greedy_search' | 'modified_beam_search' | string;
    maxActivePaths?: number;
    blankPenalty?: number;
    enableDenoise?: boolean;
    denoiseModel?: string;
    enablePunctuation?: boolean;
    punctuationModel?: string;
    enableVad?: boolean;
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

export type WavRecordingStartOptions = {
    path?: string;
    sampleRate?: number;
    chunkDurationMs?: number;
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

type SherpaOnnxNative = {
    hello(): string;
    isWavRecording(): boolean;
    startWavRecording(options?: WavRecordingStartOptions): Promise<WavRecordingStartResult>;
    stopWavRecording(): Promise<WavRecordingStopResult>;
    recoverWavRecordings(): Promise<RecoveredWavRecording[]>;
    listRecoverableWavRecordings(): Promise<RecoverableWavRecording[]>;
    recoverWavRecordingSession(sessionId: string): Promise<RecoveredWavRecording | null>;
    discardRecoverableWavRecordings(sessionIds?: string[]): Promise<DiscardRecoverableWavRecordingsResult>;
    getWavInfo(path: string): Promise<WavFileInfo>;
    transcribeWav(path: string, options?: SherpaTranscribeOptions): Promise<SherpaTranscribeResult>;
    transcribeAssetWav(assetPath: string, options?: SherpaTranscribeOptions): Promise<SherpaTranscribeResult>;
    getFileSha256(filePath: string): Promise<{ size: number; sha256: string }>;
    unzipFile(zipPath: string, destDir: string): Promise<{ ok: boolean; destDir: string }>;
    copyAssetFile(assetPath: string, destPath: string): Promise<{ ok: boolean; destPath: string }>;
};

type SherpaModelPreset = SherpaTranscribeOptions & {
    requiredFiles: readonly string[];
};

export const SHERPA_MODEL_PRESETS = {
    zh: {
        modelType: 'moonshine',
        modelDirAsset: 'sherpa/asr/zh',
        enableDenoise: false,
        denoiseModel: 'sherpa/onnx/speech-enhancement.onnx',
        enablePunctuation: false,
        punctuationModel: 'sherpa/onnx/punctuation.onnx',
        enableVad: true,
        encoder: 'encoder_model.ort',
        mergedDecoder: 'decoder_model_merged.ort',
        tokens: 'tokens.txt',
        requiredFiles: ['encoder_model.ort', 'decoder_model_merged.ort', 'tokens.txt'],
    },
    en: {
        modelType: 'moonshine',
        modelDirAsset: 'sherpa/asr/en',
        enableDenoise: false,
        denoiseModel: 'sherpa/onnx/speech-enhancement.onnx',
        enablePunctuation: false,
        punctuationModel: 'sherpa/onnx/punctuation.onnx',
        enableVad: true,
        encoder: 'encoder_model.ort',
        mergedDecoder: 'decoder_model_merged.ort',
        tokens: 'tokens.txt',
        requiredFiles: ['encoder_model.ort', 'decoder_model_merged.ort', 'tokens.txt'],
    },
    universal: {
        modelType: 'funasr_nano',
        modelDirAsset: 'sherpa/asr/universal',
        enableDenoise: false,
        denoiseModel: 'sherpa/onnx/speech-enhancement.onnx',
        enablePunctuation: false,
        punctuationModel: 'sherpa/onnx/punctuation.onnx',
        enableVad: true,
        encoderAdaptor: 'encoder_adaptor.onnx',
        llm: 'llm.onnx',
        embedding: 'embedding.onnx',
        tokenizer: 'Qwen3-0.6B',
        requiredFiles: [
            'embedding.onnx',
            'encoder_adaptor.onnx',
            'llm.onnx',
            'Qwen3-0.6B/tokenizer.json',
            'Qwen3-0.6B/merges.txt',
            'Qwen3-0.6B/vocab.json',
        ],
    },
} as const satisfies Record<string, SherpaModelPreset>;

export type SherpaModelId = keyof typeof SHERPA_MODEL_PRESETS;

const SHERPA_CDN_BASE_URL = 'https://pub-8a517913a3384e018c89aacd59a7b2db.r2.dev/models';

type DownloadModelOptions = {
    baseUrl?: string;
    force?: boolean;
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

        const baseUrl = ensureTrailingSlash(options.baseUrl ?? SHERPA_CDN_BASE_URL);
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
    return {
        ...presetWithoutAssetPath,
        modelDir: getDownloadedModelDir(modelId),
        ...overrides,
    };
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

async function ensureDownloadedRuntimeModelPaths(options: SherpaTranscribeOptions): Promise<SherpaTranscribeOptions> {
    let resolved = await ensureDownloadedAuxModelPath(options, 'denoiseModel', 'speech-enhancement');
    resolved = await ensureDownloadedAuxModelPath(resolved, 'punctuationModel', 'punctuation');
    resolved = await ensureDownloadedAuxModelPath(resolved, 'vadModel', 'vad');
    resolved = await ensureDownloadedAuxModelPath(resolved, 'speakerSegmentationModel', 'speaker-diarization');
    resolved = await ensureDownloadedAuxModelPath(resolved, 'speakerEmbeddingModel', 'speaker-recognition');
    return resolved;
}

const NativeSherpaOnnx = requireNativeModule<SherpaOnnxNative>('SherpaOnnx');

const SherpaOnnx = {
    hello: NativeSherpaOnnx.hello,
    isWavRecording: NativeSherpaOnnx.isWavRecording,
    startWavRecording: NativeSherpaOnnx.startWavRecording,
    stopWavRecording: NativeSherpaOnnx.stopWavRecording,
    recoverWavRecordings: NativeSherpaOnnx.recoverWavRecordings,
    listRecoverableWavRecordings: NativeSherpaOnnx.listRecoverableWavRecordings,
    recoverWavRecordingSession: NativeSherpaOnnx.recoverWavRecordingSession,
    discardRecoverableWavRecordings: NativeSherpaOnnx.discardRecoverableWavRecordings,
    getWavInfo: NativeSherpaOnnx.getWavInfo,
    transcribeWav: NativeSherpaOnnx.transcribeWav,
    transcribeAssetWav: NativeSherpaOnnx.transcribeAssetWav,
    getFileSha256: NativeSherpaOnnx.getFileSha256,
    unzipFile: NativeSherpaOnnx.unzipFile,
    copyAssetFile: NativeSherpaOnnx.copyAssetFile,
    downloadModel,
    ensureModelReady,
    initializeBundledModel,
    isModelDownloaded,
    getInstalledModelVersion,
    listLocalModels,
    uninstallModel,
    getDownloadedModelDir,
    async transcribeWavByDownloadedModel(path: string, modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}) {
        const options = await ensureDownloadedRuntimeModelPaths(getSherpaDownloadedModelOptions(modelId, overrides));
        return NativeSherpaOnnx.transcribeWav(path, options);
    },
};

export default SherpaOnnx;
