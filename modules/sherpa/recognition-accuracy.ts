import { getCurrentModel } from '~/data/mmkv/model-selection';
import {
    transcribeFileWithTiming,
    type RecognitionPreference,
    type RecognitionRunContext,
} from '~/modules/sherpa/recognition';
import type { SherpaModelId, SherpaTranscribeOptions } from '~/modules/sherpa';
import { runRecognitionPreflight, type RecognitionPreflightKind } from '~/modules/sherpa/recognition-preflight';
import {
    DEFAULT_RECOGNITION_ACCURACY_REFERENCE_TEXT,
    resolveDefaultRecognitionAccuracyAudioUri,
} from '~/modules/sherpa/recognition-accuracy-reference';

export type AccuracyCompareItem = {
    char: string;
    matched: boolean;
};

export type RecognitionAccuracyResult = {
    recognizedText: string;
    elapsedMs: number;
    hitCount: number;
    totalCount: number;
    hitRate: number;
    referenceItems: AccuracyCompareItem[];
    recognizedItems: AccuracyCompareItem[];
    modelId: SherpaModelId;
    timing: {
        provider: string;
        numThreads: number;
        availableProcessors: number;
        performanceTier: string;
    };
    options: SherpaTranscribeOptions;
};

export type RunRecognitionAccuracyOptions = {
    filePath: string;
    referenceText: string;
    modelId?: SherpaModelId;
    kind?: RecognitionPreflightKind;
    preference?: RecognitionPreference;
    overrides?: RecognitionRunContext['overrides'];
};

export type CompareRecognitionAccuracyOptions = {
    recognizedText: string;
    referenceText: string;
};

export type RunDefaultRecognitionAccuracyOptions = {
    modelId?: SherpaModelId;
    kind?: RecognitionPreflightKind;
    preference?: RecognitionPreference;
    overrides?: RecognitionRunContext['overrides'];
};

function isPunctuationChar(char: string): boolean {
    return /[，。！？；：“”‘’（）【】《》〈〉、,.!?;:'"()[\]{}<>…—-]/.test(char);
}

function buildLcsCompare(reference: string, recognized: string): {
    referenceItems: AccuracyCompareItem[];
    recognizedItems: AccuracyCompareItem[];
} {
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

/**
 * Dev-only recognition accuracy helper:
 * - Runs preflight checks (permission/model/version)
 * - Performs transcription
 * - Calculates LCS-based hit rate against reference text
 */
export async function runRecognitionAccuracy(options: RunRecognitionAccuracyOptions): Promise<RecognitionAccuracyResult> {
    const modelId = options.modelId ?? getCurrentModel();
    const kind = options.kind ?? 'file';
    const canContinue = await runRecognitionPreflight({
        kind,
        modelId,
    });
    if (!canContinue) {
        throw new Error('Recognition preflight failed');
    }

    const startedAt = Date.now();
    const { transcribe, options: resolvedOptions } = await transcribeFileWithTiming({
        filePath: options.filePath,
        modelId,
        preference: options.preference,
        overrides: options.overrides,
    });
    const elapsedMs = Date.now() - startedAt;
    const recognizedText = transcribe.result.text ?? '';
    const compared = buildLcsCompare(options.referenceText, recognizedText);

    const referenceWithoutPunctuation = compared.referenceItems.filter(item => !isPunctuationChar(item.char));
    const hitCount = referenceWithoutPunctuation.filter(item => item.matched).length;
    const totalCount = referenceWithoutPunctuation.length;
    const hitRate = totalCount > 0 ? hitCount / totalCount : 0;

    return {
        recognizedText,
        elapsedMs,
        hitCount,
        totalCount,
        hitRate,
        referenceItems: compared.referenceItems,
        recognizedItems: compared.recognizedItems,
        modelId,
        timing: {
            provider: transcribe.timing.provider,
            numThreads: transcribe.timing.numThreads,
            availableProcessors: transcribe.timing.availableProcessors,
            performanceTier: transcribe.timing.performanceTier,
        },
        options: resolvedOptions,
    };
}

export function compareRecognitionAccuracy(options: CompareRecognitionAccuracyOptions): RecognitionAccuracyResult {
    const compared = buildLcsCompare(options.referenceText, options.recognizedText);
    const referenceWithoutPunctuation = compared.referenceItems.filter(item => !isPunctuationChar(item.char));
    const hitCount = referenceWithoutPunctuation.filter(item => item.matched).length;
    const totalCount = referenceWithoutPunctuation.length;
    const hitRate = totalCount > 0 ? hitCount / totalCount : 0;

    return {
        recognizedText: options.recognizedText,
        elapsedMs: 0,
        hitCount,
        totalCount,
        hitRate,
        referenceItems: compared.referenceItems,
        recognizedItems: compared.recognizedItems,
        modelId: getCurrentModel(),
        timing: {
            provider: 'compare-only',
            numThreads: 0,
            availableProcessors: 0,
            performanceTier: 'n/a',
        },
        options: {},
    };
}

export async function runDefaultRecognitionAccuracy(
    options: RunDefaultRecognitionAccuracyOptions = {},
): Promise<RecognitionAccuracyResult> {
    const filePath = await resolveDefaultRecognitionAccuracyAudioUri();
    return runRecognitionAccuracy({
        filePath,
        referenceText: DEFAULT_RECOGNITION_ACCURACY_REFERENCE_TEXT,
        modelId: options.modelId,
        kind: options.kind,
        preference: options.preference,
        overrides: options.overrides,
    });
}
