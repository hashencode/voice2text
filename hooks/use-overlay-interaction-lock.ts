import React from 'react';

type Listener = () => void;

let activeLocks = 0;
const listeners = new Set<Listener>();

function notifyListeners() {
    listeners.forEach(listener => listener());
}

export function acquireOverlayInteractionLock(): () => void {
    activeLocks += 1;
    notifyListeners();

    let released = false;
    return () => {
        if (released) {
            return;
        }
        released = true;
        activeLocks = Math.max(0, activeLocks - 1);
        notifyListeners();
    };
}

export function useOverlayInteractionLocked(): boolean {
    const [locked, setLocked] = React.useState(activeLocks > 0);

    React.useEffect(() => {
        const listener = () => {
            setLocked(activeLocks > 0);
        };
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return locked;
}
