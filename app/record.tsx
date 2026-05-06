import { Stack } from 'expo-router';
import { DesignPencil } from 'iconoir-react-native';
import React from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import type { EnrichedTextInputInstance } from 'react-native-enriched';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';
import { DefaultLayout } from '~/components/layout/default-layout';
import SelectionModeLayout from '~/components/layout/selection-mode-layout';
import { useActionSheet } from '~/components/ui/action-sheet';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { BottomSheet, useBottomSheet } from '~/components/ui/bottom-sheet';
import { TextX } from '~/components/ui/textx';
import RichNoteEditor from '~/features/editor/rich-note-editor';
import { useRecordSession } from '~/features/session-editor/hooks/use-record-session';
import { useColor } from '~/hooks/use-color';

const PANEL_HEIGHT = 310;
const DEFAULT_PANEL_WIDTH = 360;
const WAVE_SAMPLE_STEP_MS = 100;
const BAR_WIDTH = 3;
const VISIBLE_WINDOW_MS = 6000;
const TIMELINE_STEP_MS = 2000;
const CONTENT_SIDE_PADDING_MS = 1000;

type WaveformPoint = {
    level: number;
    timeMs: number;
};

export default function RecordPage() {
    const noteInputRef = React.useRef<EnrichedTextInputInstance | null>(null);
    const noteSheet = useBottomSheet();
    const [panelWidth, setPanelWidth] = React.useState(DEFAULT_PANEL_WIDTH);
    const { show: showActionSheet, ActionSheet } = useActionSheet();
    const {
        noteText,
        setNoteText,
        markers,
        confirmDialogState,
        closeConfirmDialog,
        cancelConfirmDialog,
        elapsedMs,
        elapsedPreciseText,
        actionLoading,
        isPaused,
        isRecordingOrPaused,
        isStopping,
        canStop,
        isIdleLike,
        handleAddMarker,
        handleLeftAction,
        handleConfirmStop,
        goToReview,
        handleBackPress,
        leaveRecordPage,
        discardSession,
        waveformPoints,
    } = useRecordSession();

    const cardColor = useColor('card');
    const mutedColor = useColor('muted');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const destructiveColor = useColor('destructive');
    const destructiveForegroundColor = useColor('destructiveForeground');
    const borderColor = useColor('border');
    const redColor = useColor('red');

    const timerText = elapsedPreciseText.replace('.', ':');
    const handlePanelLayout = React.useCallback(
        (event: LayoutChangeEvent) => {
            const nextWidth = Math.round(event.nativeEvent.layout.width);
            if (nextWidth > 0 && nextWidth !== panelWidth) {
                setPanelWidth(nextWidth);
            }
        },
        [panelWidth],
    );
    const handleTopBackPress = React.useCallback(() => {
        if (!canStop || isStopping) {
            handleBackPress();
            return;
        }

        showActionSheet({
            title: '结束本次录音',
            message: '你想先做什么？',
            cancelButtonTitle: '取消',
            options: [
                {
                    title: '去确认保存',
                    description: '暂停录音并前往保存确认页',
                    onPress: () => {
                        void goToReview();
                    },
                },
                {
                    title: '放弃本次录音',
                    description: '删除当前录音和速记草稿',
                    destructive: true,
                    onPress: () => {
                        void discardSession().then(() => {
                            leaveRecordPage();
                        });
                    },
                },
            ],
        });
    }, [canStop, discardSession, goToReview, handleBackPress, isStopping, leaveRecordPage, showActionSheet]);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />
            <View className="flex-1">
                <SelectionModeLayout left="录音" isSelectionMode={false} showBackButton onBackPress={handleTopBackPress} />

                <View className="flex-1 px-4 pb-4">
                    <View className="mt-6 items-center">
                        <TextX
                            className="text-[58px] font-light tracking-tight"
                            style={{ color: textColor, fontVariant: ['tabular-nums'] }}>
                            {timerText}
                        </TextX>
                    </View>

                    <View
                        className="mt-8 flex-1 overflow-hidden rounded-[30px] px-4 pt-5"
                        style={{ backgroundColor: cardColor }}
                        onLayout={handlePanelLayout}>
                        <LiveWaveformPanel
                            elapsedMs={elapsedMs}
                            waveformPoints={waveformPoints}
                            markers={markers}
                            panelWidth={panelWidth}
                            textColor={textColor}
                            mutedTextColor={mutedTextColor}
                            borderColor={borderColor}
                            markerColor={redColor}
                        />
                    </View>

                    <Pressable
                        onPress={noteSheet.open}
                        className={`mt-4 items-center rounded-2xl px-4 py-3 ${isStopping ? 'opacity-50' : ''}`}
                        disabled={isStopping}
                        style={{ backgroundColor: mutedColor }}>
                        <DesignPencil width={22} height={22} color={textColor} />
                        <TextX className="mt-2 text-sm font-medium" style={{ color: textColor }}>
                            灵感速记
                        </TextX>
                        <TextX className="mt-1 text-xs" style={{ color: mutedTextColor }}>
                            {stripRichTextPreview(noteText) || '记录这一刻的想法'}
                        </TextX>
                    </Pressable>

                    <View className="mt-6 flex-row items-end justify-between px-3">
                        <RoundActionButton
                            label="标记"
                            onPress={handleAddMarker}
                            disabled={!isRecordingOrPaused || isStopping}
                            backgroundColor={mutedColor}
                            textColor={textColor}>
                            <FlagGlyph color={textColor} />
                        </RoundActionButton>

                        <RoundActionButton
                            label="停止"
                            onPress={handleConfirmStop}
                            disabled={!canStop || isStopping}
                            backgroundColor={destructiveColor}
                            textColor={destructiveForegroundColor}
                            size={96}
                            shadow>
                            <View className="h-7 w-7 rounded-md" style={{ backgroundColor: destructiveForegroundColor }} />
                        </RoundActionButton>

                        <RoundActionButton
                            label={isIdleLike ? '开始' : isPaused ? '继续' : '暂停'}
                            onPress={handleLeftAction}
                            disabled={actionLoading || isStopping}
                            backgroundColor={mutedColor}
                            textColor={textColor}>
                            <PauseGlyph paused={isIdleLike || isPaused} color={textColor} />
                        </RoundActionButton>
                    </View>
                    <BottomSafeAreaSpacer />
                </View>
            </View>

            <BottomSheet isVisible={noteSheet.isVisible} onClose={noteSheet.close} title="灵感速记" snapPoints={[0.55, 0.78]}>
                <View className="h-[420px]">
                    <RichNoteEditor
                        placeholder="记录此刻的想法、关键词或标记说明"
                        inputRef={noteInputRef}
                        initialText={noteText}
                        onTextChange={setNoteText}
                    />
                </View>
            </BottomSheet>

            <AlertDialog
                isVisible={confirmDialogState.isVisible}
                title={confirmDialogState.title}
                description={confirmDialogState.description}
                confirmText={confirmDialogState.confirmText}
                confirmButtonProps={confirmDialogState.confirmButtonProps}
                cancelText="取消"
                onConfirm={confirmDialogState.onConfirm}
                onClose={closeConfirmDialog}
                onCancel={cancelConfirmDialog}
            />
            {ActionSheet}
        </DefaultLayout>
    );
}

function LiveWaveformPanel({
    elapsedMs,
    waveformPoints,
    markers,
    panelWidth,
    textColor,
    mutedTextColor,
    borderColor,
    markerColor,
}: {
    elapsedMs: number;
    waveformPoints: WaveformPoint[];
    markers: { timeMs: number }[];
    panelWidth: number;
    textColor: string;
    mutedTextColor: string;
    borderColor: string;
    markerColor: string;
}) {
    const cursorX = panelWidth / 2;
    const pixelsPerMs = panelWidth / VISIBLE_WINDOW_MS;
    const contentWidth = panelWidth + CONTENT_SIDE_PADDING_MS * 2 * pixelsPerMs;
    const baseElapsedMs = Math.floor(elapsedMs / WAVE_SAMPLE_STEP_MS) * WAVE_SAMPLE_STEP_MS;
    const fractionalOffsetMs = elapsedMs - baseElapsedMs;
    const startMs = baseElapsedMs - VISIBLE_WINDOW_MS / 2 - CONTENT_SIDE_PADDING_MS;
    const endMs = baseElapsedMs + VISIBLE_WINDOW_MS / 2 + CONTENT_SIDE_PADDING_MS;
    const translateX = useSharedValue(0);

    React.useEffect(() => {
        translateX.value = -(fractionalOffsetMs * pixelsPerMs);
    }, [fractionalOffsetMs, pixelsPerMs, translateX]);

    const animatedContentStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const labels = React.useMemo(() => {
        const firstTickMs = Math.floor(startMs / TIMELINE_STEP_MS) * TIMELINE_STEP_MS;
        const ticks: { timeMs: number; x: number; label: string }[] = [];

        for (let timeMs = firstTickMs; timeMs <= endMs + TIMELINE_STEP_MS; timeMs += TIMELINE_STEP_MS) {
            const x = (timeMs - startMs) * pixelsPerMs;
            if (x < -36 || x > contentWidth + 12) {
                continue;
            }
            ticks.push({
                timeMs,
                x,
                label: formatAxisLabel(timeMs),
            });
        }

        return ticks;
    }, [contentWidth, endMs, pixelsPerMs, startMs]);

    const waveformBars = React.useMemo(() => {
        const levelByBucketMs = new Map<number, number>();
        for (const point of waveformPoints) {
            const bucketTimeMs = alignTimeToGrid(point.timeMs);
            const prevLevel = levelByBucketMs.get(bucketTimeMs) ?? 0;
            levelByBucketMs.set(bucketTimeMs, Math.max(prevLevel, point.level));
        }

        const firstBucketMs = Math.floor(startMs / WAVE_SAMPLE_STEP_MS) * WAVE_SAMPLE_STEP_MS;
        const bars: { timeMs: number; x: number; height: number }[] = [];
        let lastLevel = 0;
        let carryFramesRemaining = 0;

        for (let timeMs = firstBucketMs; timeMs <= endMs + WAVE_SAMPLE_STEP_MS; timeMs += WAVE_SAMPLE_STEP_MS) {
            const x = (timeMs - startMs) * pixelsPerMs;
            if (x < -BAR_WIDTH || x > contentWidth + BAR_WIDTH) {
                continue;
            }
            const rawLevel = levelByBucketMs.get(timeMs);
            const resolvedLevel =
                typeof rawLevel === 'number'
                    ? rawLevel
                    : carryFramesRemaining > 0
                      ? lastLevel
                      : 0;
            if (typeof rawLevel === 'number') {
                lastLevel = rawLevel;
                carryFramesRemaining = 1;
            } else if (carryFramesRemaining > 0) {
                carryFramesRemaining -= 1;
            } else {
                lastLevel = 0;
            }
            bars.push({
                timeMs,
                x,
                height: getWaveformBarHeight(resolvedLevel),
            });
        }

        return bars;
    }, [contentWidth, endMs, pixelsPerMs, startMs, waveformPoints]);

    const visibleMarkers = React.useMemo(
        () =>
            markers
                .map(marker => ({
                    timeMs: marker.timeMs,
                    x: (marker.timeMs - startMs) * pixelsPerMs,
                }))
                .filter(marker => marker.x >= -4 && marker.x <= contentWidth + 4),
        [contentWidth, markers, pixelsPerMs, startMs],
    );
    const centerY = PANEL_HEIGHT / 2;

    return (
        <View className="flex-1">
            <View className="h-7 overflow-hidden">
                <Animated.View
                    className="h-7"
                    style={[
                        {
                            width: contentWidth,
                            marginLeft: -CONTENT_SIDE_PADDING_MS * pixelsPerMs,
                        },
                        animatedContentStyle,
                    ]}>
                    {labels.map(item => (
                        <TextX
                            key={`${item.timeMs}-${item.label}`}
                            className="absolute text-[13px]"
                            style={{ left: item.x - 18, color: mutedTextColor, fontVariant: ['tabular-nums'] }}>
                            {item.label}
                        </TextX>
                    ))}
                </Animated.View>
            </View>

            <View className="mt-3 flex-1 overflow-hidden">
                <Svg width={panelWidth} height={PANEL_HEIGHT} viewBox={`0 0 ${panelWidth} ${PANEL_HEIGHT}`} className="absolute left-0 top-0">
                    <Line
                        x1="0"
                        y1={centerY}
                        x2={panelWidth}
                        y2={centerY}
                        stroke={borderColor}
                        strokeWidth="1.2"
                        strokeDasharray="3 5"
                    />
                    <Line x1={cursorX} y1="0" x2={cursorX} y2={PANEL_HEIGHT} stroke={markerColor} strokeWidth="2" />
                </Svg>

                <Animated.View
                    className="absolute left-0 top-0"
                    style={[
                        {
                            width: contentWidth,
                            height: PANEL_HEIGHT,
                            marginLeft: -CONTENT_SIDE_PADDING_MS * pixelsPerMs,
                        },
                        animatedContentStyle,
                    ]}>
                    <Svg width={contentWidth} height={PANEL_HEIGHT} viewBox={`0 0 ${contentWidth} ${PANEL_HEIGHT}`}>
                        {visibleMarkers.map((marker, index) => (
                            <Line
                                key={`${marker.timeMs}-${index}`}
                                x1={marker.x}
                                y1="0"
                                x2={marker.x}
                                y2={PANEL_HEIGHT}
                                stroke={markerColor}
                                strokeWidth="2"
                                opacity="0.55"
                            />
                        ))}

                        {waveformBars.map((bar, index) => (
                            <Rect
                                key={`${bar.timeMs}-${index}`}
                                x={bar.x - BAR_WIDTH / 2}
                                y={centerY - bar.height / 2}
                                width={BAR_WIDTH}
                                height={bar.height}
                                rx="1.5"
                                fill={textColor}
                            />
                        ))}
                    </Svg>
                </Animated.View>
            </View>
        </View>
    );
}

function alignTimeToGrid(timeMs: number): number {
    return Math.round(timeMs / WAVE_SAMPLE_STEP_MS) * WAVE_SAMPLE_STEP_MS;
}

function getWaveformBarHeight(level: number): number {
    const noiseFloor = 0.035;
    if (level <= noiseFloor) {
        return 3;
    }
    const normalizedLevel = Math.max(0, Math.min(1, (level - noiseFloor) / 0.72));
    const shapedLevel = normalizedLevel ** 1.08;
    return 3 + shapedLevel * 172;
}

function RoundActionButton({
    children,
    label,
    onPress,
    disabled,
    backgroundColor,
    textColor,
    size = 72,
    shadow = false,
}: {
    children: React.ReactNode;
    label: string;
    onPress: () => void;
    disabled?: boolean;
    backgroundColor: string;
    textColor: string;
    size?: number;
    shadow?: boolean;
}) {
    return (
        <View className="items-center gap-2">
            <Pressable
                disabled={disabled}
                onPress={onPress}
                className={`items-center justify-center rounded-full ${disabled ? 'opacity-40' : ''} ${shadow ? 'shadow-lg' : ''}`}
                style={{ width: size, height: size, backgroundColor }}>
                {children}
            </Pressable>
            <TextX className="text-sm" style={{ color: textColor }}>
                {label}
            </TextX>
        </View>
    );
}

function PauseGlyph({ paused, color }: { paused: boolean; color: string }) {
    if (paused) {
        return (
            <View className="ml-1 h-0 w-0 border-b-[12px] border-l-[18px] border-t-[12px] border-b-transparent border-t-transparent" style={{ borderLeftColor: color }} />
        );
    }

    return (
        <View className="flex-row gap-1.5">
            <View className="h-6 w-1.5 rounded-full" style={{ backgroundColor: color }} />
            <View className="h-6 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        </View>
    );
}

function FlagGlyph({ color }: { color: string }) {
    return (
        <View className="items-start">
            <View className="h-6 w-[2px]" style={{ backgroundColor: color }} />
            <View className="absolute left-[2px] top-[1px] h-0 w-0 border-b-[6px] border-l-[12px] border-t-[6px] border-b-transparent border-t-transparent" style={{ borderLeftColor: color }} />
        </View>
    );
}

function formatAxisLabel(timeMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function stripRichTextPreview(rawText: string): string {
    return rawText.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
