import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { requireNativeModule } from 'expo-modules-core';

export type SherpaTranscribeOptions = {
    modelDirAsset?: string;
    modelDir?: string;
    modelType?:
        | 'transducer'
        | 'zipformer'
        | 'zipformer2'
        | 'zipformer2_ctc'
        | 'zipformer_ctc'
        | 'ctc'
        | 'funasr_nano'
        | string;
    encoder?: string;
    decoder?: string;
    joiner?: string;
    model?: string;
    encoderAdaptor?: string;
    llm?: string;
    embedding?: string;
    tokenizer?: string; // FunASR Nano expects tokenizer directory (e.g. Qwen3-0.6B), not tokenizer.json file path
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

export type SherpaRealtimeOptions = SherpaTranscribeOptions & {
    emitIntervalMs?: number;
    enableEndpoint?: boolean;
};

export type SherpaRealtimeResultEvent = {
    type: 'partial' | 'final' | 'error';
    text?: string;
    tokens?: string[];
    timestamps?: number[];
    isFinal?: boolean;
    isEndpoint?: boolean;
    sampleRate?: number;
    message?: string;
};

export type SherpaRealtimeStateEvent = {
    state: 'starting' | 'running' | 'stopped' | 'error';
    error?: string | null;
};

type SherpaRealtimeSubscription = {
    remove(): void;
};

type SherpaOnnxNative = {
    hello(): string;
    isRealtimeTranscribing(): boolean;
    isWavRecording(): boolean;
    startWavRecording(options?: { path?: string; sampleRate?: number }): Promise<{ path: string; sampleRate: number }>;
    stopWavRecording(): Promise<{ path: string; sampleRate: number; numSamples: number }>;
    startRealtimeTranscription(options?: SherpaRealtimeOptions): Promise<{ started: boolean }>;
    stopRealtimeTranscription(): Promise<{ stopped: boolean }>;
    transcribeWav(path: string, options?: SherpaTranscribeOptions): Promise<SherpaTranscribeResult>;
    transcribeAssetWav(assetPath: string, options?: SherpaTranscribeOptions): Promise<SherpaTranscribeResult>;
    getFileSha256(filePath: string): Promise<{ size: number; sha256: string }>;
    unzipFile(zipPath: string, destDir: string): Promise<{ ok: boolean; destDir: string }>;
    copyAssetFile(assetPath: string, destPath: string): Promise<{ ok: boolean; destPath: string }>;
    addListener(eventName: string, listener: (event: any) => void): SherpaRealtimeSubscription;
};

export const SHERPA_MODEL_PRESETS = {
    'zipformer-zh-streaming': {
        modelType: 'transducer',
        modelDirAsset: 'sherpa/models/zipformer-zh-streaming',
        encoder: 'encoder.onnx',
        decoder: 'decoder.onnx',
        joiner: 'joiner.onnx',
        tokens: 'tokens.txt',
    },
    'zipformer-ctc-zh': {
        modelType: 'zipformer2_ctc',
        modelDirAsset: 'sherpa/models/zipformer-ctc-zh',
        model: 'model.onnx',
        tokens: 'tokens.txt',
    },
    'funasr-nano': {
        modelType: 'funasr_nano',
        modelDirAsset: 'sherpa/models/funasr-nano',
        encoderAdaptor: 'encoder_adaptor.onnx',
        llm: 'llm.onnx',
        embedding: 'embedding.onnx',
        tokenizer: 'Qwen3-0.6B',
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
    'zipformer-zh-streaming': ['encoder.onnx', 'decoder.onnx', 'joiner.onnx', 'tokens.txt'],
    'zipformer-ctc-zh': ['model.onnx', 'tokens.txt'],
    'funasr-nano': [
        'encoder_adaptor.onnx',
        'llm.onnx',
        'embedding.onnx',
        'Qwen3-0.6B/tokenizer.json',
        'Qwen3-0.6B/vocab.json',
        'Qwen3-0.6B/merges.txt',
    ],
};

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

function getModelVersionFilePath(modelId: SherpaModelId): string {
    return `${getDownloadedModelDir(modelId)}version.txt`;
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

async function validateRequiredFilesInDir(baseDir: string, requiredFiles: string[]): Promise<ExtractedModelValidation> {
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
    const requiredFiles = SHERPA_REMOTE_MODEL_FILES[modelId];
    const dirInfo = await FileSystem.getInfoAsync(modelDir);
    if (!dirInfo.exists || !dirInfo.isDirectory) {
        return { ok: false, issues: ['model directory is missing'] };
    }
    const requiredCheck = await validateRequiredFilesInDir(modelDir, requiredFiles);
    if (!requiredCheck.ok) {
        return requiredCheck;
    }
    const versionInfo = await FileSystem.getInfoAsync(getModelVersionFilePath(modelId));
    if (!versionInfo.exists || versionInfo.isDirectory || typeof versionInfo.size !== 'number' || versionInfo.size <= 0) {
        return { ok: false, issues: ['version.txt is missing'] };
    }
    console.info(`[sherpa] version.txt exists, skip file sha validation: ${modelId}`);
    return { ok: true, issues: [] };
}

async function verifyExtractedModelHashes(modelId: SherpaModelId, meta: ModelPackageMeta): Promise<ExtractedModelValidation> {
    const modelDir = getDownloadedModelDir(modelId);
    const requiredFiles = SHERPA_REMOTE_MODEL_FILES[modelId];
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

async function writeModelVersionFile(modelId: SherpaModelId, version: string): Promise<void> {
    await FileSystem.writeAsStringAsync(getModelVersionFilePath(modelId), `${version}\n`);
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

async function extractModelZip(modelId: SherpaModelId, meta: ModelPackageMeta): Promise<void> {
    const zipPath = getModelZipPath(modelId);
    const modelDir = getDownloadedModelDir(modelId);
    const tempDir = getModelExtractTempDir(modelId);
    const stageDir = getModelExtractStageDir(modelId);
    const extractingMarker = getModelExtractingMarkerPath(modelId);
    const requiredFiles = SHERPA_REMOTE_MODEL_FILES[modelId];

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
        await writeModelVersionFile(modelId, meta.version);
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
        }

        if (!localMeta) {
            localMeta = await downloadModelMeta(modelId, baseUrl, options.onProgress);
        }

        const zipExistsAfterMeta = (await FileSystem.getInfoAsync(getModelZipPath(modelId))).exists;
        if (!zipExistsAfterMeta) {
            await downloadModelZipWithResume(modelId, baseUrl, options.onProgress);
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
    const extractedCheck = await validateExtractedModelFiles(modelId);

    if (!options.force && extractedCheck.ok) {
        console.info(`[sherpa] model already ready, skip ensure: ${modelId}`);
        await removeModelPackageFiles(modelId);
        options.onProgress?.({ modelId, phase: 'ready', percent: 1 });
        return modelDir;
    }

    if (!options.force) {
        const hasZip = (await FileSystem.getInfoAsync(getModelZipPath(modelId))).exists;
        const hasJson = (await FileSystem.getInfoAsync(getModelJsonPath(modelId))).exists;
        if (!hasZip && !hasJson && (await FileSystem.getInfoAsync(modelDir)).exists) {
            throw new Error(`Model files are invalid for ${modelId}: ${extractedCheck.issues.join('; ')}`);
        }
    }

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
        const bundledJsonAssetPath = `sherpa/models/${modelId}.json`;
        const bundledZipAssetPath = `sherpa/models/${modelId}.zip`;
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
    const { modelDirAsset: _ignoredModelDirAsset, ...presetWithoutAssetPath } = SHERPA_MODEL_PRESETS[modelId];
    return {
        ...presetWithoutAssetPath,
        modelDir: getDownloadedModelDir(modelId),
        ...overrides,
    };
}

const NativeSherpaOnnx = requireNativeModule<SherpaOnnxNative>('SherpaOnnx');

function assertRealtimeCompatibleOptions(options: SherpaTranscribeOptions, modelId: SherpaModelId): void {
    const modelType = options.modelType ?? 'transducer';
    if (modelType === 'funasr_nano') {
        throw new Error(`Model ${modelId} is offline-only (funasr_nano). Use transcribeWav instead of realtime transcription.`);
    }
}

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
    listLocalModels,
    getDownloadedModelDir,
    transcribeWavByDownloadedModel(path: string, modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}) {
        return NativeSherpaOnnx.transcribeWav(path, getSherpaDownloadedModelOptions(modelId, overrides));
    },
    transcribeAssetWavByDownloadedModel(assetPath: string, modelId: SherpaModelId, overrides: SherpaTranscribeOptions = {}) {
        return NativeSherpaOnnx.transcribeAssetWav(assetPath, getSherpaDownloadedModelOptions(modelId, overrides));
    },
    startRealtimeTranscriptionByModel(modelId: SherpaModelId, overrides: SherpaRealtimeOptions = {}) {
        const options = getSherpaModelOptions(modelId, overrides);
        assertRealtimeCompatibleOptions(options, modelId);
        return NativeSherpaOnnx.startRealtimeTranscription(options);
    },
    startRealtimeTranscriptionByDownloadedModel(modelId: SherpaModelId, overrides: SherpaRealtimeOptions = {}) {
        const options = getSherpaDownloadedModelOptions(modelId, overrides);
        assertRealtimeCompatibleOptions(options, modelId);
        return NativeSherpaOnnx.startRealtimeTranscription(options);
    },
    addRealtimeResultListener(listener: (event: SherpaRealtimeResultEvent) => void): SherpaRealtimeSubscription {
        return NativeSherpaOnnx.addListener('onRealtimeTranscription', listener);
    },
    addRealtimeStateListener(listener: (event: SherpaRealtimeStateEvent) => void): SherpaRealtimeSubscription {
        return NativeSherpaOnnx.addListener('onRealtimeState', listener);
    },
};

export default SherpaOnnx;
