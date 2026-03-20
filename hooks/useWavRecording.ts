import { AudioModule } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WavRecordingStopResult } from '~/modules/sherpa';
import SherpaOnnx from '~/modules/sherpa';

type UseWavRecordingOptions = {
    sampleRate?: number;
    createTargetPath: () => Promise<string> | string;
    onStart?: () => void;
    onStop?: (result: WavRecordingStopResult) => Promise<void> | void;
    onPermissionDenied?: () => void;
    onError?: (error: Error) => void;
};

function formatRecordingElapsed(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function useWavRecording({
    sampleRate = 16000,
    createTargetPath,
    onStart,
    onStop,
    onPermissionDenied,
    onError,
}: UseWavRecordingOptions) {
    const [isRecording, setIsRecording] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);
    const recordingStartAtRef = useRef<number | null>(null);

    const startTimer = useCallback(() => {
        recordingStartAtRef.current = Date.now();
        setElapsedMs(0);
    }, []);

    const stopTimer = useCallback(() => {
        recordingStartAtRef.current = null;
        setElapsedMs(0);
    }, []);

    useEffect(() => {
        if (!isRecording) {
            return;
        }
        const timer = setInterval(() => {
            const startAt = recordingStartAtRef.current;
            if (!startAt) {
                return;
            }
            setElapsedMs(Date.now() - startAt);
        }, 200);
        return () => clearInterval(timer);
    }, [isRecording]);

    const toggleRecord = useCallback(async () => {
        if (actionLoading) {
            return;
        }

        setActionLoading(true);
        try {
            if (!isRecording) {
                const permission = await AudioModule.requestRecordingPermissionsAsync();
                if (!permission.granted) {
                    onPermissionDenied?.();
                    return;
                }

                const targetPath = await createTargetPath();
                await SherpaOnnx.startWavRecording({ sampleRate, path: targetPath });
                startTimer();
                setIsRecording(true);
                onStart?.();
                return;
            }

            const result = await SherpaOnnx.stopWavRecording();
            setIsRecording(false);
            stopTimer();
            await onStop?.(result);
        } catch (error) {
            setIsRecording(false);
            stopTimer();
            onError?.(error as Error);
        } finally {
            setActionLoading(false);
        }
    }, [actionLoading, createTargetPath, isRecording, onError, onPermissionDenied, onStart, onStop, sampleRate, startTimer, stopTimer]);

    useEffect(() => {
        return () => {
            stopTimer();
            if (!SherpaOnnx.isWavRecording()) {
                return;
            }
            SherpaOnnx.stopWavRecording().catch(() => {});
        };
    }, [stopTimer]);

    return {
        isRecording,
        actionLoading,
        elapsedMs,
        elapsedText: formatRecordingElapsed(elapsedMs),
        buttonText: isRecording ? '停止录音并保存' : '开始录音',
        toggleRecord,
    };
}
