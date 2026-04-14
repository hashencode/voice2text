import React from 'react';
import FileListItem from '~/features/home/file-list/file-list-item';
import { Checkbox } from '~/components/ui/checkbox';
import { Separator } from '~/components/ui/separator';
import { formatDate, formatDuration } from '~/utils/format';

type RecordingListItem = {
    path: string;
    displayName: string | null;
    isFavorite: boolean;
    durationMs: number | null;
    recordedAtMs: number | null;
};

type RecordingListViewProps = {
    items: RecordingListItem[];
    isMultiSelectMode: boolean;
    selectedPaths: string[];
    extractFileName: (path: string) => string;
    onToggleSelectPath: (path: string) => void;
    onEnterMultiSelectWithItem: (path: string) => void;
    onOpenSingleActionForItem: (path: string) => void;
    onOpenItem: (item: RecordingListItem) => void;
};

export default function FileListView({
    items,
    isMultiSelectMode,
    selectedPaths,
    extractFileName,
    onToggleSelectPath,
    onEnterMultiSelectWithItem,
    onOpenSingleActionForItem,
    onOpenItem,
}: RecordingListViewProps) {
    return (
        <>
            {items.length > 0 ? <Separator /> : null}
            {items.map((item, index) => (
                <React.Fragment key={item.path}>
                    <FileListItem
                        name={item.displayName?.trim() || extractFileName(item.path)}
                        isFavorite={item.isFavorite}
                        durationText={formatDuration(item.durationMs)}
                        createdAtText={formatDate(item.recordedAtMs)}
                        showArrow={!isMultiSelectMode}
                        onPress={() => {
                            if (isMultiSelectMode) {
                                onToggleSelectPath(item.path);
                                return;
                            }
                            onOpenItem(item);
                        }}
                        onLongPress={isMultiSelectMode ? () => onToggleSelectPath(item.path) : () => onEnterMultiSelectWithItem(item.path)}
                        onPressMore={() => onOpenSingleActionForItem(item.path)}
                        rightSlot={
                            isMultiSelectMode ? (
                                <Checkbox
                                    checked={selectedPaths.includes(item.path)}
                                    onCheckedChange={() => onToggleSelectPath(item.path)}
                                />
                            ) : undefined
                        }
                    />
                    <Separator />
                </React.Fragment>
            ))}
        </>
    );
}
