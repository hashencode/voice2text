import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'app-config' });

export const APP_CONFIG_KEYS = {
    darkMode: 'app.config.darkMode',
    speakerDiarizationEnabled: 'app.config.speakerDiarizationEnabled',
    denoiseEnabled: 'app.config.denoiseEnabled',
    vadEngine: 'app.config.vadEngine',
    finalTranscribeUseVad: 'app.config.finalTranscribeUseVad',
    finalTranscribeUseSpeakerDiarization: 'app.config.finalTranscribeUseSpeakerDiarization',
    currentRecordingFolderName: 'app.config.currentRecordingFolderName',
} as const;

type BoolConfigKey =
    | typeof APP_CONFIG_KEYS.darkMode
    | typeof APP_CONFIG_KEYS.speakerDiarizationEnabled
    | typeof APP_CONFIG_KEYS.denoiseEnabled
    | typeof APP_CONFIG_KEYS.finalTranscribeUseVad
    | typeof APP_CONFIG_KEYS.finalTranscribeUseSpeakerDiarization;
export type VadEngineId = 'tenvad' | 'silerovad';
const DEFAULT_VAD_ENGINE: VadEngineId = 'tenvad';

const DEFAULT_BOOL_VALUES: Record<BoolConfigKey, boolean> = {
    [APP_CONFIG_KEYS.darkMode]: false,
    [APP_CONFIG_KEYS.speakerDiarizationEnabled]: false,
    [APP_CONFIG_KEYS.denoiseEnabled]: false,
    [APP_CONFIG_KEYS.finalTranscribeUseVad]: true,
    [APP_CONFIG_KEYS.finalTranscribeUseSpeakerDiarization]: true,
};

function getBool(key: BoolConfigKey): boolean {
    const value = storage.getBoolean(key);
    if (value === undefined) {
        return DEFAULT_BOOL_VALUES[key];
    }
    return value;
}

function setBool(key: BoolConfigKey, value: boolean): void {
    storage.set(key, value);
}

export function getDarkModeEnabled(): boolean {
    return getBool(APP_CONFIG_KEYS.darkMode);
}

export function setDarkModeEnabled(value: boolean): void {
    setBool(APP_CONFIG_KEYS.darkMode, value);
}

export function getSpeakerDiarizationEnabled(): boolean {
    return getBool(APP_CONFIG_KEYS.speakerDiarizationEnabled);
}

export function setSpeakerDiarizationEnabled(value: boolean): void {
    setBool(APP_CONFIG_KEYS.speakerDiarizationEnabled, value);
}

export function getDenoiseEnabled(): boolean {
    return getBool(APP_CONFIG_KEYS.denoiseEnabled);
}

export function setDenoiseEnabled(value: boolean): void {
    setBool(APP_CONFIG_KEYS.denoiseEnabled, value);
}

export function getVadEngine(): VadEngineId {
    const value = storage.getString(APP_CONFIG_KEYS.vadEngine) as VadEngineId | undefined;
    if (value === 'tenvad' || value === 'silerovad') {
        return value;
    }
    return DEFAULT_VAD_ENGINE;
}

export function setVadEngine(value: VadEngineId): void {
    storage.set(APP_CONFIG_KEYS.vadEngine, value);
}

export function getFinalTranscribeUseVad(): boolean {
    const value = storage.getBoolean(APP_CONFIG_KEYS.finalTranscribeUseVad);
    if (value !== undefined) {
        return value;
    }
    return DEFAULT_BOOL_VALUES[APP_CONFIG_KEYS.finalTranscribeUseVad];
}

export function setFinalTranscribeUseVad(value: boolean): void {
    setBool(APP_CONFIG_KEYS.finalTranscribeUseVad, value);
}

export function getFinalTranscribeUseSpeakerDiarization(): boolean {
    const value = storage.getBoolean(APP_CONFIG_KEYS.finalTranscribeUseSpeakerDiarization);
    if (value !== undefined) {
        return value;
    }
    return DEFAULT_BOOL_VALUES[APP_CONFIG_KEYS.finalTranscribeUseSpeakerDiarization];
}

export function setFinalTranscribeUseSpeakerDiarization(value: boolean): void {
    setBool(APP_CONFIG_KEYS.finalTranscribeUseSpeakerDiarization, value);
}

export function getCurrentRecordingFolderName(): string | null {
    const value = storage.getString(APP_CONFIG_KEYS.currentRecordingFolderName)?.trim() ?? '';
    return value ? value : null;
}

export function setCurrentRecordingFolderName(value: string | null): void {
    const normalizedValue = value?.trim() ?? '';
    storage.set(APP_CONFIG_KEYS.currentRecordingFolderName, normalizedValue);
}
