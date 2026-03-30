import React from 'react';
import FolderListItem from '~/components/home/folder-list/folder-list-item';
import { Checkbox } from '~/components/ui/checkbox';
import { Separator } from '~/components/ui/separator';
import { formatDate } from '~/utils/format';

type FolderEntry = {
    name: string;
    createdAtMs: number;
    isFavorite: boolean;
};

type FolderListViewProps = {
    folders: FolderEntry[];
    selectedFolder: string;
    selectedFolderNames: string[];
    allFoldersKey: string;
    isMultiSelectMode: boolean;
    fileCountByFolderName: Record<string, number>;
    onSelectFolder: (name: string) => void;
    onToggleSelectFolderName: (name: string) => void;
    onEnterMultiSelectWithFolder: (name: string) => void;
    onOpenSingleActionForFolder: (name: string) => void;
};

export default function FolderListView({
    folders,
    selectedFolder,
    selectedFolderNames,
    allFoldersKey,
    isMultiSelectMode,
    fileCountByFolderName,
    onSelectFolder,
    onToggleSelectFolderName,
    onEnterMultiSelectWithFolder,
    onOpenSingleActionForFolder,
}: FolderListViewProps) {
    return (
        <>
            {folders.map((folder, index) => {
                const isAllFolder = folder.name === allFoldersKey;
                const displayName = isAllFolder ? '全部文件' : folder.name;
                const fileCount = fileCountByFolderName[folder.name] ?? 0;

                return (
                    <React.Fragment key={folder.name}>
                        <FolderListItem
                            name={displayName}
                            isFavorite={folder.isFavorite}
                            fileCountText={`${fileCount} 个文件`}
                            createdAtText={formatDate(folder.createdAtMs)}
                            showCreatedAt={!isAllFolder}
                            onPress={() => {
                                if (isMultiSelectMode) {
                                    if (isAllFolder) {
                                        return;
                                    }
                                    onToggleSelectFolderName(folder.name);
                                    return;
                                }
                                onSelectFolder(folder.name);
                            }}
                            onLongPress={
                                isMultiSelectMode
                                    ? () => {
                                          if (isAllFolder) {
                                              return;
                                          }
                                          onToggleSelectFolderName(folder.name);
                                      }
                                    : () => onEnterMultiSelectWithFolder(folder.name)
                            }
                            onPressMore={isAllFolder ? undefined : () => onOpenSingleActionForFolder(folder.name)}
                            showArrow={!isMultiSelectMode && !isAllFolder}
                            rightSlot={
                                isMultiSelectMode && !isAllFolder ? (
                                    <Checkbox
                                        checked={selectedFolderNames.includes(folder.name)}
                                        onCheckedChange={() => onToggleSelectFolderName(folder.name)}
                                    />
                                ) : undefined
                            }
                        />
                        {index < folders.length - 1 ? <Separator /> : null}
                    </React.Fragment>
                );
            })}
        </>
    );
}
