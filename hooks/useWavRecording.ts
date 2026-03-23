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

type RecordingPhase = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';

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
    const [phase, setPhase] = useState<RecordingPhase>('idle');
    const [elapsedMs, setElapsedMs] = useState(0);
    const recordingStartAtRef = useRef<number | null>(null);
    const actionInFlightRef = useRef(false);

    const startTimer = useCallback(() => {
        recordingStartAtRef.current = Date.now();
        setElapsedMs(0);
    }, []);

    const stopTimer = useCallback(() => {
        recordingStartAtRef.current = null;
        setElapsedMs(0);
    }, []);

    useEffect(() => {
        if (phase !== 'recording') {
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
    }, [phase]);

    const toggleRecord = useCallback(async () => {
        if (actionInFlightRef.current) {
            return;
        }

        actionInFlightRef.current = true;
        try {
            if (phase === 'idle' || phase === 'error') {
                setPhase('starting');
                const permission = await AudioModule.requestRecordingPermissionsAsync();
                if (!permission.granted) {
                    setPhase('idle');
                    onPermissionDenied?.();
                    return;
                }

                const targetPath = await createTargetPath();
                await SherpaOnnx.startWavRecording({ sampleRate, path: targetPath });
                startTimer();
                setPhase('recording');
                onStart?.();
                return;
            }

            if (phase !== 'recording') {
                return;
            }

            setPhase('stopping');
            const result = await SherpaOnnx.stopWavRecording();
            stopTimer();
            setPhase('idle');
            await onStop?.(result);
        } catch (error) {
            stopTimer();
            setPhase('error');
            onError?.(error as Error);
        } finally {
            actionInFlightRef.current = false;
        }
    }, [createTargetPath, onError, onPermissionDenied, onStart, onStop, phase, sampleRate, startTimer, stopTimer]);

    useEffect(() => {
        return () => {
            stopTimer();
            if (!SherpaOnnx.isWavRecording()) {
                return;
            }
            SherpaOnnx.stopWavRecording().catch(() => {});
        };
    }, [stopTimer]);

    const isRecording = phase === 'recording' || phase === 'stopping';
    const actionLoading = phase === 'starting' || phase === 'stopping';
    const buttonText =
        phase === 'starting'
            ? '正在启动录音...'
            : phase === 'stopping'
              ? '正在停止录音并保存...'
              : phase === 'recording'
                ? '停止录音并保存'
                : '开始录音';

    return {
        phase,
        isRecording,
        actionLoading,
        elapsedMs,
        elapsedText: formatRecordingElapsed(elapsedMs),
        buttonText,
        toggleRecord,
    };
}
