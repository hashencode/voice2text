import { AudioModule } from 'expo-audio';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { getInstalledModelVersion, isModelDownloaded, type SherpaModelId } from '~/modules/sherpa';
import { MIN_MODEL_VERSION_BY_MODEL_ID } from '~/scripts/const';

export type RecognitionPreflightKind = 'file' | 'recording';

function compareModelVersion(left: string, right: string): number {
    const leftParts = left.split('.').map(part => Number.parseInt(part, 10));
    const rightParts = right.split('.').map(part => Number.parseInt(part, 10));
    const hasNaN = [...leftParts, ...rightParts].some(Number.isNaN);
    if (hasNaN) {
        return left.localeCompare(right);
    }
    const maxLen = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < maxLen; index += 1) {
        const leftValue = leftParts[index] ?? 0;
        const rightValue = rightParts[index] ?? 0;
        if (leftValue !== rightValue) {
            return leftValue - rightValue;
        }
    }
    return 0;
}

async function ensureFileAccessPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
        return true;
    }

    // Android 13+ uses SAF for DocumentPicker, no storage runtime permission is required.
    if (Platform.Version >= 33) {
        return true;
    }

    const targetPermission = PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    const alreadyGranted = await PermissionsAndroid.check(targetPermission);
    if (alreadyGranted) {
        return true;
    }

    const requestResult = await PermissionsAndroid.request(targetPermission);
    const granted = requestResult === PermissionsAndroid.RESULTS.GRANTED;
    if (!granted) {
        Alert.alert('权限不足', '未授予文件访问权限，无法继续文件识别。');
    }
    return granted;
}

async function ensureMicrophonePermission(): Promise<boolean> {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    return permission.granted;
}

async function ensureModelInstalled(modelId: SherpaModelId): Promise<boolean> {
    const installed = await isModelDownloaded(modelId);
    if (!installed) {
        Alert.alert('模型未安装', `当前模型 ${modelId} 未安装，请先到 Libs 页面安装后再试。`);
        return false;
    }

    const installedVersion = await getInstalledModelVersion(modelId);
    if (!installedVersion) {
        Alert.alert('模型不可用', `当前模型 ${modelId} 的版本信息缺失或损坏，请重新安装后再试。`);
        return false;
    }

    const minimumVersion = MIN_MODEL_VERSION_BY_MODEL_ID[modelId];
    if (!minimumVersion) {
        return true;
    }

    if (compareModelVersion(installedVersion, minimumVersion) < 0) {
        Alert.alert('模型版本过低', `当前模型 ${modelId} 版本为 ${installedVersion}，至少需要 ${minimumVersion}。请重新安装。`);
        return false;
    }

    return true;
}

export async function runRecognitionPreflight(options: { kind: RecognitionPreflightKind; modelId: SherpaModelId }): Promise<boolean> {
    const permissionGranted = options.kind === 'file' ? await ensureFileAccessPermission() : await ensureMicrophonePermission();
    if (!permissionGranted) {
        return false;
    }

    return ensureModelInstalled(options.modelId);
}
