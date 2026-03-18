import { createMMKV } from 'react-native-mmkv';
import type { SherpaModelId, SherpaOutputMode } from '~/modules/sherpa';
import { SHERPA_MODEL_PRESETS } from '~/modules/sherpa';

export const SHERPA_MODEL_SELECTION_KEYS = {
    nonStreaming: 'sherpa.current.nonStreamingModel',
} as const;

const storage = createMMKV({ id: 'sherpa-model-selection' });
const DEFAULT_MODEL_BY_OUTPUT_MODE: Record<SherpaOutputMode, SherpaModelId> = {
    nonStreaming: 'zh',
};

type GetCurrentModelOptions = {
    withDefault?: boolean;
};

export function getCurrentModelByOutputMode(outputMode: SherpaOutputMode): SherpaModelId;
export function getCurrentModelByOutputMode(outputMode: SherpaOutputMode, options: { withDefault: true }): SherpaModelId;
export function getCurrentModelByOutputMode(outputMode: SherpaOutputMode, options: { withDefault: false }): SherpaModelId | null;
export function getCurrentModelByOutputMode(outputMode: SherpaOutputMode, options?: GetCurrentModelOptions): SherpaModelId | null;
export function getCurrentModelByOutputMode(
    outputMode: SherpaOutputMode,
    options: GetCurrentModelOptions = { withDefault: true },
): SherpaModelId | null {
    const key = SHERPA_MODEL_SELECTION_KEYS.nonStreaming;
    const modelId = (storage.getString(key) ?? null) as SherpaModelId | null;
    if (!options.withDefault) {
        return modelId;
    }

    const fallbackModelId = DEFAULT_MODEL_BY_OUTPUT_MODE[outputMode];
    if (!modelId || !(modelId in SHERPA_MODEL_PRESETS) || SHERPA_MODEL_PRESETS[modelId].outputMode !== outputMode) {
        storage.set(key, fallbackModelId);
        return fallbackModelId;
    }

    return modelId;
}

export function setCurrentModelByOutputMode(outputMode: SherpaOutputMode, modelId: SherpaModelId): void {
    if (outputMode !== 'nonStreaming') {
        throw new Error(`Unsupported outputMode: ${outputMode}`);
    }
    storage.set(SHERPA_MODEL_SELECTION_KEYS.nonStreaming, modelId);
}
