import type { SherpaModelId } from '~/modules/sherpa';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'model-selection' });
const MODEL_SELECTION_KEY = 'app.modelSelection.currentModel';
const DEFAULT_MODEL_ID: SherpaModelId = 'moonshine-zh';
const SUPPORTED_MODEL_IDS = new Set<SherpaModelId>(['moonshine-zh', 'paraformer-zh']);

type GetCurrentModelOptions = {
    withDefault?: boolean;
};

export function getCurrentModel(): SherpaModelId;
export function getCurrentModel(options: { withDefault: true }): SherpaModelId;
export function getCurrentModel(options: { withDefault: false }): SherpaModelId;
export function getCurrentModel(options?: GetCurrentModelOptions): SherpaModelId;
export function getCurrentModel(_options: GetCurrentModelOptions = { withDefault: true }): SherpaModelId {
    const value = storage.getString(MODEL_SELECTION_KEY);
    if (value && SUPPORTED_MODEL_IDS.has(value as SherpaModelId)) {
        return value as SherpaModelId;
    }
    return DEFAULT_MODEL_ID;
}

export function setCurrentModel(modelId: SherpaModelId): void {
    if (!SUPPORTED_MODEL_IDS.has(modelId)) {
        return;
    }
    storage.set(MODEL_SELECTION_KEY, modelId);
}
