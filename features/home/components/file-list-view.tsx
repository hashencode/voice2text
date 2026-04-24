import { Calendar, Clock } from 'iconoir-react-native';
import { Ellipsis, Heart } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Checkbox } from '~/components/ui/checkbox';
import { Separator } from '~/components/ui/separator';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/use-color';
import { FONT_SIZE_LG } from '~/theme/globals';

export type RecordingListItem = {
    path: string;
    displayName: string | null;
    isFavorite: boolean;
    durationMs: number | null;
    recordedAtMs: number | null;
};

type RecordingListViewProps = {
    items: RecordingListItem[];
    isMultiSelectMode: boolean;
    selectedPathSet: ReadonlySet<string>;
    extractFileName: (path: string) => string;
    onToggleSelectPath: (path: string) => void;
    onEnterMultiSelectWithItem: (path: string) => void;
    onOpenSingleActionForItem: (path: string) => void;
    onOpenItem: (item: RecordingListItem) => void;
};

type FileListRowProps = {
    item: RecordingListItem;
    isMultiSelectMode: boolean;
    isSelected: boolean;
    extractFileName: (path: string) => string;
    onToggleSelectPath: (path: string) => void;
    onEnterMultiSelectWithItem: (path: string) => void;
    onOpenSingleActionForItem: (path: string) => void;
    onOpenItem: (item: RecordingListItem) => void;
};

const META_TEXT_STYLE = {
    lineHeight: 14,
    includeFontPadding: false as const,
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
    selectedPathSet,
    extractFileName,
    onToggleSelectPath,
    onEnterMultiSelectWithItem,
    onOpenSingleActionForItem,
    onOpenItem,
}: RecordingListViewProps) {
    return (
        <>
            {items.map(item => (
                <React.Fragment key={item.path}>
                    <FileListRow
                        item={item}
                        isMultiSelectMode={isMultiSelectMode}
                        isSelected={selectedPathSet.has(item.path)}
                        extractFileName={extractFileName}
                        onToggleSelectPath={onToggleSelectPath}
                        onEnterMultiSelectWithItem={onEnterMultiSelectWithItem}
                        onOpenSingleActionForItem={onOpenSingleActionForItem}
                        onOpenItem={onOpenItem}
                    />
                    <Separator />
                </React.Fragment>
            ))}
        </>
    );
}

function FileListRowImpl({
    item,
    isMultiSelectMode,
    isSelected,
    extractFileName,
    onToggleSelectPath,
    onEnterMultiSelectWithItem,
    onOpenSingleActionForItem,
    onOpenItem,
}: FileListRowProps) {
    const descriptionColor = useColor('textMuted');
    const actionIconColor = useColor('text');

    return (
        <Pressable
            className="h-24 w-full flex-row items-center justify-between p-4"
            onPress={() => {
                if (isMultiSelectMode) {
                    onToggleSelectPath(item.path);
                    return;
                }
                onOpenItem(item);
            }}
            onLongPress={isMultiSelectMode ? () => onToggleSelectPath(item.path) : () => onEnterMultiSelectWithItem(item.path)}
            delayLongPress={500}>
            <View className="flex-1 gap-y-2.5 pr-4">
                <View className="flex-row items-center gap-x-1">
                    {item.isFavorite ? <Heart size={FONT_SIZE_LG} color="#EF4444" /> : null}
                    <TextX variant="subtitle" numberOfLines={1} className="flex-1">
                        {item.displayName?.trim() || extractFileName(item.path)}
                    </TextX>
                </View>

                <View className="flex-row items-center gap-x-4 gap-y-1">
                    <View className="flex-row items-center gap-x-1.5">
                        <Clock width={14} height={14} strokeWidth={2} color={descriptionColor} />
                        <TextX variant="description" style={META_TEXT_STYLE}>
                            {formatDuration(item.durationMs)}
                        </TextX>
                    </View>
                    <View className="flex-row items-center gap-x-1.5">
                        <Calendar width={14} height={14} strokeWidth={2} color={descriptionColor} />
                        <TextX variant="description" style={META_TEXT_STYLE}>
                            {formatDate(item.recordedAtMs)}
                        </TextX>
                    </View>
                </View>
            </View>

            <View className="shrink-0">
                {isMultiSelectMode ? (
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelectPath(item.path)} />
                ) : (
                    <Pressable
                        onPress={event => {
                            event.stopPropagation();
                            onOpenSingleActionForItem(item.path);
                        }}>
                        <View className="h-9 w-9 items-center justify-center rounded-xl">
                            <Ellipsis size={18} color={actionIconColor} />
                        </View>
                    </Pressable>
                )}
            </View>
        </Pressable>
    );
}

export const FileListRow = React.memo(FileListRowImpl, (prev, next) => {
    return (
        prev.item === next.item &&
        prev.isMultiSelectMode === next.isMultiSelectMode &&
        prev.isSelected === next.isSelected &&
        prev.extractFileName === next.extractFileName &&
        prev.onToggleSelectPath === next.onToggleSelectPath &&
        prev.onEnterMultiSelectWithItem === next.onEnterMultiSelectWithItem &&
        prev.onOpenSingleActionForItem === next.onOpenSingleActionForItem &&
        prev.onOpenItem === next.onOpenItem
    );
});
