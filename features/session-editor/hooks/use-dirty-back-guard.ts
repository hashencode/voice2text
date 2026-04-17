import React from 'react';

type UseDirtyBackGuardOptions = {
    timeoutMs?: number;
    onFirstBackWhenDirty: () => void;
};

type DirtyBackAttemptParams = {
    isDirty: boolean;
    onConfirmed: () => void | Promise<void>;
};

export function useDirtyBackGuard({
    timeoutMs: _timeoutMs = 2000,
    onFirstBackWhenDirty: _onFirstBackWhenDirty,
}: UseDirtyBackGuardOptions) {
    const resetDirtyBackGuard = React.useCallback(() => {
        // no-op: keep API stable for callers while removing double-press behavior
    }, []);

    const runDirtyBackAttempt = React.useCallback(
        async ({ isDirty, onConfirmed }: DirtyBackAttemptParams): Promise<boolean> => {
            if (!isDirty) {
                resetDirtyBackGuard();
                return false;
            }

            resetDirtyBackGuard();
            await onConfirmed();
            return true;
        },
        [resetDirtyBackGuard],
    );

    return {
        resetDirtyBackGuard,
        runDirtyBackAttempt,
    };
}
