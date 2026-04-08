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

type RecordingPhase = 'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'error';

function formatRecordingElapsed(ms: number, includeMilliseconds = false, fractionDigits = 3): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const milliseconds = Math.max(0, ms % 1000);
    const safeFractionDigits = Math.max(1, Math.min(3, fractionDigits));
    const fractionBase = 10 ** (3 - safeFractionDigits);
    const fraction = Math.floor(milliseconds / fractionBase)
        .toString()
        .padStart(safeFractionDigits, '0');
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        const hhmmss = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        return includeMilliseconds ? `${hhmmss}.${fraction}` : hhmmss;
    }
    const mmss = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return includeMilliseconds ? `${mmss}.${fraction}` : mmss;
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
    const elapsedBaseRef = useRef(0);
    const actionInFlightRef = useRef(false);
    const rafIdRef = useRef<number | null>(null);

    const startTimer = useCallback((reset: boolean) => {
        if (reset) {
            elapsedBaseRef.current = 0;
            setElapsedMs(0);
        }
        recordingStartAtRef.current = Date.now();
    }, []);

    const pauseTimer = useCallback(() => {
        if (recordingStartAtRef.current) {
            elapsedBaseRef.current += Date.now() - recordingStartAtRef.current;
        }
        recordingStartAtRef.current = null;
        setElapsedMs(elapsedBaseRef.current);
    }, []);

    const resetTimer = useCallback(() => {
        recordingStartAtRef.current = null;
        elapsedBaseRef.current = 0;
        setElapsedMs(0);
    }, []);

    useEffect(() => {
        if (phase !== 'recording') {
            return;
        }
        const tick = () => {
            const startAt = recordingStartAtRef.current;
            if (!startAt) {
                return;
            }
            setElapsedMs(elapsedBaseRef.current + (Date.now() - startAt));
            rafIdRef.current = requestAnimationFrame(tick);
        };

        rafIdRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, [phase]);

    const startRecord = useCallback(async () => {
        if (actionInFlightRef.current) {
            return;
        }

        actionInFlightRef.current = true;
        try {
            if (phase !== 'idle' && phase !== 'error') {
                return;
            }

            setPhase('starting');
            const permission = await AudioModule.requestRecordingPermissionsAsync();
            if (!permission.granted) {
                setPhase('idle');
                onPermissionDenied?.();
                return;
            }

            const targetPath = await createTargetPath();
            await SherpaOnnx.startWavRecording({ sampleRate, path: targetPath });
            startTimer(true);
            setPhase('recording');
            onStart?.();
        } catch (error) {
            resetTimer();
            setPhase('error');
            onError?.(error as Error);
        } finally {
            actionInFlightRef.current = false;
        }
    }, [createTargetPath, onError, onPermissionDenied, onStart, phase, sampleRate, startTimer, resetTimer]);

    const pauseRecord = useCallback(async () => {
        if (actionInFlightRef.current || phase !== 'recording') {
            return;
        }
        actionInFlightRef.current = true;
        try {
            await SherpaOnnx.pauseWavRecording();
            pauseTimer();
            setPhase('paused');
        } catch (error) {
            setPhase('error');
            onError?.(error as Error);
        } finally {
            actionInFlightRef.current = false;
        }
    }, [onError, phase, pauseTimer]);

    const resumeRecord = useCallback(async () => {
        if (actionInFlightRef.current || phase !== 'paused') {
            return;
        }
        actionInFlightRef.current = true;
        try {
            await SherpaOnnx.resumeWavRecording();
            startTimer(false);
            setPhase('recording');
        } catch (error) {
            setPhase('error');
            onError?.(error as Error);
        } finally {
            actionInFlightRef.current = false;
        }
    }, [onError, phase, startTimer]);

    const stopRecord = useCallback(async () => {
        if (actionInFlightRef.current) {
            return;
        }
        if (phase !== 'recording' && phase !== 'paused') {
            return;
        }

        actionInFlightRef.current = true;
        try {
            if (phase === 'recording') {
                pauseTimer();
            }
            setPhase('stopping');
            const result = await SherpaOnnx.stopWavRecording();
            resetTimer();
            setPhase('idle');
            await onStop?.(result);
        } catch (error) {
            resetTimer();
            setPhase('error');
            onError?.(error as Error);
        } finally {
            actionInFlightRef.current = false;
        }
    }, [onError, onStop, phase, pauseTimer, resetTimer]);

    const toggleRecord = useCallback(async () => {
        if (phase === 'idle' || phase === 'error') {
            await startRecord();
            return;
        }
        if (phase === 'recording' || phase === 'paused') {
            await stopRecord();
        }
    }, [phase, startRecord, stopRecord]);

    useEffect(() => {
        return () => {
            resetTimer();
            if (!SherpaOnnx.isWavRecording()) {
                return;
            }
            SherpaOnnx.stopWavRecording().catch(() => {});
        };
    }, [resetTimer]);

    const isRecording = phase === 'recording' || phase === 'stopping';
    const isPaused = phase === 'paused';
    const actionLoading = phase === 'starting' || phase === 'stopping';
    const buttonText =
        phase === 'starting'
            ? '正在启动录音...'
            : phase === 'stopping'
              ? '正在停止录音并保存...'
              : phase === 'paused'
                ? '继续录音'
                : phase === 'recording'
                  ? '停止录音并保存'
                  : '开始录音';

    return {
        phase,
        isRecording,
        isPaused,
        actionLoading,
        elapsedMs,
        elapsedText: formatRecordingElapsed(elapsedMs),
        elapsedPreciseText: formatRecordingElapsed(elapsedMs, true, 2),
        buttonText,
        startRecord,
        pauseRecord,
        resumeRecord,
        stopRecord,
        toggleRecord,
    };
}
