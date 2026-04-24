import React from 'react';

export function useFileSelection(filteredPaths: string[]) {
    const [selectedPathSet, setSelectedPathSet] = React.useState<Set<string>>(() => new Set<string>());

    const selectedPaths = React.useMemo(() => Array.from(selectedPathSet), [selectedPathSet]);

    const setSelectedPaths = React.useCallback((next: React.SetStateAction<string[]>) => {
        setSelectedPathSet(prev => {
            const prevArray = Array.from(prev);
            const resolved = typeof next === 'function' ? next(prevArray) : next;
            return new Set(resolved);
        });
    }, []);

    const toggleSelectPath = React.useCallback((path: string) => {
        setSelectedPathSet(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    const clearSelectedPaths = React.useCallback(() => {
        setSelectedPathSet(new Set<string>());
    }, []);

    const addSelectedPath = React.useCallback((path: string) => {
        setSelectedPathSet(prev => {
            if (prev.has(path)) {
                return prev;
            }
            const next = new Set(prev);
            next.add(path);
            return next;
        });
    }, []);

    const isAllFilteredSelected = React.useMemo(
        () => filteredPaths.length > 0 && filteredPaths.every(path => selectedPathSet.has(path)),
        [filteredPaths, selectedPathSet],
    );

    const toggleSelectAllFiltered = React.useCallback(() => {
        if (filteredPaths.length === 0) {
            return;
        }
        setSelectedPathSet(prev => {
            const allSelected = filteredPaths.every(path => prev.has(path));
            if (allSelected) {
                const next = new Set(prev);
                filteredPaths.forEach(path => next.delete(path));
                return next;
            }
            const next = new Set(prev);
            filteredPaths.forEach(path => next.add(path));
            return next;
        });
    }, [filteredPaths]);

    return {
        selectedPaths,
        selectedPathSet,
        setSelectedPaths,
        toggleSelectPath,
        clearSelectedPaths,
        addSelectedPath,
        isAllFilteredSelected,
        toggleSelectAllFiltered,
    };
}
