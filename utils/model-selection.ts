import { createMMKV } from 'react-native-mmkv';
import type { SherpaModelId, SherpaOutputMode } from '~/modules/sherpa';

export const SHERPA_MODEL_SELECTION_KEYS = {
    streaming: 'sherpa.current.streamingModel',
    nonStreaming: 'sherpa.current.nonStreamingModel',
} as const;

const storage = createMMKV({ id: 'sherpa-model-selection' });

export function getCurrentModelByOutputMode(outputMode: SherpaOutputMode): SherpaModelId | null {
    const key = outputMode === 'streaming' ? SHERPA_MODEL_SELECTION_KEYS.streaming : SHERPA_MODEL_SELECTION_KEYS.nonStreaming;
    return (storage.getString(key) ?? null) as SherpaModelId | null;
}

export function setCurrentModelByOutputMode(outputMode: SherpaOutputMode, modelId: SherpaModelId): void {
    const key = outputMode === 'streaming' ? SHERPA_MODEL_SELECTION_KEYS.streaming : SHERPA_MODEL_SELECTION_KEYS.nonStreaming;
    storage.set(key, modelId);
}
