import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'app-config' });

export const APP_CONFIG_KEYS = {
    darkMode: 'app.config.darkMode',
    currentRecordingFolderName: 'app.config.currentRecordingFolderName',
} as const;

type BoolConfigKey = typeof APP_CONFIG_KEYS.darkMode;
export type VadEngineId = 'tenvad' | 'silerovad';

const DEFAULT_BOOL_VALUES: Record<BoolConfigKey, boolean> = {
    [APP_CONFIG_KEYS.darkMode]: false,
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

export function getCurrentRecordingFolderName(): string | null {
    const value = storage.getString(APP_CONFIG_KEYS.currentRecordingFolderName)?.trim() ?? '';
    return value ? value : null;
}

export function setCurrentRecordingFolderName(value: string | null): void {
    const normalizedValue = value?.trim() ?? '';
    storage.set(APP_CONFIG_KEYS.currentRecordingFolderName, normalizedValue);
}
