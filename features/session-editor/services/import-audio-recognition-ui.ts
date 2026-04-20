export type RecognitionLanguage = 'zh' | 'en';
export type RecognitionMode = 'offline' | 'online';
export type RecognitionState = 'idle' | 'preparing' | 'recognizing' | 'stopped' | 'success' | 'failed';

export function isRecognitionBusyState(state: RecognitionState): boolean {
    return state === 'preparing' || state === 'recognizing';
}

export function toRecognitionLanguageLabel(language: RecognitionLanguage): string {
    return language === 'zh' ? '中文' : '英文';
}

export function toRecognitionModeLabel(mode: RecognitionMode): string {
    return mode === 'online' ? '在线识别' : '离线识别';
}

export function getRecognitionPrimaryAction(state: RecognitionState, mode: RecognitionMode): 'stop' | 'start-offline' | 'start-online' {
    if (isRecognitionBusyState(state)) {
        return 'stop';
    }
    return mode === 'online' ? 'start-online' : 'start-offline';
}
