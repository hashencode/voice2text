import type { SherpaModelId } from '~/modules/sherpa';

const FIXED_MODEL_ID: SherpaModelId = 'qwen3';

type GetCurrentModelOptions = {
    withDefault?: boolean;
};

export function getCurrentModel(): SherpaModelId;
export function getCurrentModel(options: { withDefault: true }): SherpaModelId;
export function getCurrentModel(options: { withDefault: false }): SherpaModelId;
export function getCurrentModel(options?: GetCurrentModelOptions): SherpaModelId;
export function getCurrentModel(_options: GetCurrentModelOptions = { withDefault: true }): SherpaModelId {
    return FIXED_MODEL_ID;
}

export function setCurrentModel(_modelId: SherpaModelId): void {
    // Kept as a no-op for backward compatibility; model is fixed to qwen3.
}
