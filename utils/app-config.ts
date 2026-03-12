import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'app-config' });

export const APP_CONFIG_KEYS = {
    darkMode: 'app.config.darkMode',
    vadEnabled: 'app.config.vadEnabled',
    speakerDiarizationEnabled: 'app.config.speakerDiarizationEnabled',
    denoiseEnabled: 'app.config.denoiseEnabled',
    recognitionProfile: 'app.config.recognitionProfile',
} as const;

type BoolConfigKey =
    | typeof APP_CONFIG_KEYS.darkMode
    | typeof APP_CONFIG_KEYS.vadEnabled
    | typeof APP_CONFIG_KEYS.speakerDiarizationEnabled
    | typeof APP_CONFIG_KEYS.denoiseEnabled;
export type RecognitionProfileId = 'zh-cn' | 'zh-en' | 'en';

const DEFAULT_RECOGNITION_PROFILE: RecognitionProfileId = 'zh-cn';

const DEFAULT_BOOL_VALUES: Record<BoolConfigKey, boolean> = {
    [APP_CONFIG_KEYS.darkMode]: false,
    [APP_CONFIG_KEYS.vadEnabled]: true,
    [APP_CONFIG_KEYS.speakerDiarizationEnabled]: false,
    [APP_CONFIG_KEYS.denoiseEnabled]: true,
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

export function getVadEnabled(): boolean {
    return getBool(APP_CONFIG_KEYS.vadEnabled);
}

export function setVadEnabled(value: boolean): void {
    setBool(APP_CONFIG_KEYS.vadEnabled, value);
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

export function getRecognitionProfile(): RecognitionProfileId {
    const value = storage.getString(APP_CONFIG_KEYS.recognitionProfile) as RecognitionProfileId | undefined;
    if (value === 'zh-cn' || value === 'zh-en' || value === 'en') {
        return value;
    }
    return DEFAULT_RECOGNITION_PROFILE;
}

export function setRecognitionProfile(value: RecognitionProfileId): void {
    storage.set(APP_CONFIG_KEYS.recognitionProfile, value);
}

export function getPunctuationModelByProfile(profile: RecognitionProfileId = getRecognitionProfile()): string {
    if (profile.includes('zh')) {
        return 'sherpa/punctuation/zh-en.onnx';
    }
    return 'sherpa/punctuation/en.onnx';
}

export function getSpeakerEmbeddingModelByProfile(profile: RecognitionProfileId = getRecognitionProfile()): string {
    if (profile === 'zh-cn') {
        return 'sherpa/speaker-recognition/zh-cn.onnx';
    }
    if (profile === 'zh-en') {
        return 'sherpa/speaker-recognition/zh-en.onnx';
    }
    return 'sherpa/speaker-recognition/en.onnx';
}
