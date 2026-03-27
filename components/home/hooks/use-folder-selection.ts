import React from 'react';

export function useFolderSelection(selectableFolderNames: string[], allFoldersKey: string) {
    const [selectedFolderNames, setSelectedFolderNames] = React.useState<string[]>([]);

    const toggleSelectFolderName = React.useCallback(
        (name: string) => {
            if (name === allFoldersKey) {
                return;
            }
            setSelectedFolderNames(prev => (prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]));
        },
        [allFoldersKey],
    );

    const clearSelectedFolderNames = React.useCallback(() => {
        setSelectedFolderNames([]);
    }, []);

    const addSelectedFolderName = React.useCallback(
        (name: string) => {
            if (name === allFoldersKey) {
                return;
            }
            setSelectedFolderNames(prev => (prev.includes(name) ? prev : [...prev, name]));
        },
        [allFoldersKey],
    );

    const isAllFoldersSelected = React.useMemo(
        () => selectableFolderNames.length > 0 && selectableFolderNames.every(name => selectedFolderNames.includes(name)),
        [selectableFolderNames, selectedFolderNames],
    );

    const toggleSelectAllFolders = React.useCallback(() => {
        if (selectableFolderNames.length === 0) {
            return;
        }
        setSelectedFolderNames(prev => {
            const allSelected = selectableFolderNames.every(name => prev.includes(name));
            if (allSelected) {
                return prev.filter(name => !selectableFolderNames.includes(name));
            }
            const merged = new Set(prev);
            selectableFolderNames.forEach(name => merged.add(name));
            return Array.from(merged);
        });
    }, [selectableFolderNames]);

    return {
        selectedFolderNames,
        setSelectedFolderNames,
        toggleSelectFolderName,
        clearSelectedFolderNames,
        addSelectedFolderName,
        isAllFoldersSelected,
        toggleSelectAllFolders,
    };
}
