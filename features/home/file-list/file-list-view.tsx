import React from 'react';
import FileListItem from '~/features/home/file-list/file-list-item';
import { Checkbox } from '~/components/ui/checkbox';
import { Separator } from '~/components/ui/separator';

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

function formatDuration(ms: number | null, fallback = '未知时长'): string {
    if (ms === null || ms < 0) {
        return fallback;
    }

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(ms: number | null, fallback = '未知日期'): string {
    if (ms === null || ms <= 0) {
        return fallback;
    }

    const date = new Date(ms);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}`;
}

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
