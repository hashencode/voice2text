import { AudioModule } from 'expo-audio';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { isModelDownloaded, type SherpaModelId } from '~/modules/sherpa';

export type RecognitionPreflightKind = 'file' | 'recording';

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
    if (installed) {
        return true;
    }
    Alert.alert('模型未安装', `当前模型 ${modelId} 未安装，请先到 Libs 页面安装后再试。`);
    return false;
}

export async function runRecognitionPreflight(options: { kind: RecognitionPreflightKind; modelId: SherpaModelId }): Promise<boolean> {
    const permissionGranted = options.kind === 'file' ? await ensureFileAccessPermission() : await ensureMicrophonePermission();
    if (!permissionGranted) {
        return false;
    }

    return ensureModelInstalled(options.modelId);
}
