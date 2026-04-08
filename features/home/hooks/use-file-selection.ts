import React from 'react';

export function useFileSelection(filteredPaths: string[]) {
    const [selectedPaths, setSelectedPaths] = React.useState<string[]>([]);

    const toggleSelectPath = React.useCallback((path: string) => {
        setSelectedPaths(prev => (prev.includes(path) ? prev.filter(item => item !== path) : [...prev, path]));
    }, []);

    const clearSelectedPaths = React.useCallback(() => {
        setSelectedPaths([]);
    }, []);

    const addSelectedPath = React.useCallback((path: string) => {
        setSelectedPaths(prev => (prev.includes(path) ? prev : [...prev, path]));
    }, []);

    const isAllFilteredSelected = React.useMemo(
        () => filteredPaths.length > 0 && filteredPaths.every(path => selectedPaths.includes(path)),
        [filteredPaths, selectedPaths],
    );

    const toggleSelectAllFiltered = React.useCallback(() => {
        if (filteredPaths.length === 0) {
            return;
        }
        setSelectedPaths(prev => {
            const allSelected = filteredPaths.every(path => prev.includes(path));
            if (allSelected) {
                return prev.filter(path => !filteredPaths.includes(path));
            }
            const merged = new Set(prev);
            filteredPaths.forEach(path => merged.add(path));
            return Array.from(merged);
        });
    }, [filteredPaths]);

    return {
        selectedPaths,
        setSelectedPaths,
        toggleSelectPath,
        clearSelectedPaths,
        addSelectedPath,
        isAllFilteredSelected,
        toggleSelectAllFiltered,
    };
}
