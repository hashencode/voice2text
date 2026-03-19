import { createMMKV } from 'react-native-mmkv';
import type { SherpaModelId } from '~/modules/sherpa';
import { SHERPA_MODEL_PRESETS } from '~/modules/sherpa';

const SHERPA_CURRENT_MODEL_KEY = 'sherpa.current.model';
const DEFAULT_MODEL_ID: SherpaModelId = 'zh';

const storage = createMMKV({ id: 'sherpa-model-selection' });

type GetCurrentModelOptions = {
    withDefault?: boolean;
};

export function getCurrentModel(): SherpaModelId;
export function getCurrentModel(options: { withDefault: true }): SherpaModelId;
export function getCurrentModel(options: { withDefault: false }): SherpaModelId | null;
export function getCurrentModel(options?: GetCurrentModelOptions): SherpaModelId | null;
export function getCurrentModel(options: GetCurrentModelOptions = { withDefault: true }): SherpaModelId | null {
    const modelId = (storage.getString(SHERPA_CURRENT_MODEL_KEY) ?? null) as SherpaModelId | null;
    if (!options.withDefault) {
        return modelId;
    }

    if (!modelId || !(modelId in SHERPA_MODEL_PRESETS)) {
        storage.set(SHERPA_CURRENT_MODEL_KEY, DEFAULT_MODEL_ID);
        return DEFAULT_MODEL_ID;
    }

    return modelId;
}

export function setCurrentModel(modelId: SherpaModelId): void {
    if (!(modelId in SHERPA_MODEL_PRESETS)) {
        throw new Error(`Unsupported modelId: ${modelId}`);
    }
    storage.set(SHERPA_CURRENT_MODEL_KEY, modelId);
}
