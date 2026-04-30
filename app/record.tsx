import { Stack } from 'expo-router';
import { DesignPencil } from 'iconoir-react-native';
import { ArrowLeft, Flag, PauseIcon, PlayIcon, Square } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import type { EnrichedTextInputInstance } from 'react-native-enriched';
import { DefaultLayout } from '~/components/layout/default-layout';
import { AlertDialog } from '~/components/ui/alert-dialog';
import { BottomSafeAreaSpacer } from '~/components/ui/bottom-safe-area-spacer';
import { BottomSheet, useBottomSheet } from '~/components/ui/bottom-sheet';
import { IconButton } from '~/components/ui/icon-button';
import { TextX } from '~/components/ui/textx';
import RichNoteEditor from '~/features/editor/rich-note-editor';
import SessionHeader from '~/features/session-editor/components/session-header';
import { useRecordSession } from '~/features/session-editor/hooks/use-record-session';
import { useColor } from '~/hooks/use-color';

const RULER_LABELS = ['00:02', '00:04', '00:06', '00:08'];
const RULER_TICK_COUNT = 22;
const WAVE_SEGMENT_COUNT = 72;
const WAVE_CENTER_INDEX = Math.floor(WAVE_SEGMENT_COUNT / 2);

function splitElapsedDisplay(elapsedPreciseText: string) {
    const normalized = elapsedPreciseText.replace('.', ':');
    const splitIndex = normalized.lastIndexOf(':');
    if (splitIndex <= 0) {
        return { muted: normalized, focus: '' };
    }

    return {
        muted: normalized.slice(0, splitIndex + 1),
        focus: normalized.slice(splitIndex + 1),
    };
}

export default function RecordPage() {
    const noteInputRef = React.useRef<EnrichedTextInputInstance | null>(null);
    const { isVisible: isRemarkSheetVisible, open: openRemarkSheet, close: closeRemarkSheet } = useBottomSheet();
    const {
        displayName,
        setDisplayName,
        headerAtMs,
        remarkText,
        markerTimestamps,
        handleRemarkTextChange,
        handleAddMarker,
        confirmDialogState,
        closeConfirmDialog,
        cancelConfirmDialog,
        phase,
        actionLoading,
        elapsedMs,
        elapsedText,
        elapsedPreciseText,
        isPaused,
        isStopping,
        canStop,
        isIdleLike,
        handleLeftAction,
        handleConfirmStop,
        handleBackPress,
    } = useRecordSession();

    const primaryColor = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');
    const destructiveColor = useColor('destructive');
    const destructiveForegroundColor = useColor('destructiveForeground');
    const textColor = useColor('text');
    const mutedTextColor = useColor('textMuted');
    const cardColor = useColor('card');
    const mutedColor = useColor('muted');

    const timerDisplay = React.useMemo(() => splitElapsedDisplay(elapsedPreciseText), [elapsedPreciseText]);

    const waveHeights = React.useMemo(() => {
        const isLive = phase === 'recording' || phase === 'paused';
        const frame = Math.floor(elapsedMs / 90);

        return Array.from({ length: WAVE_SEGMENT_COUNT }, (_, index) => {
            if (index >= WAVE_CENTER_INDEX) {
                return 3;
            }

            if (!isLive) {
                return index % 3 === 0 ? 8 : 6;
            }

            const signalA = Math.sin((index + frame) * 0.42);
            const signalB = Math.cos((index * 0.68 + frame) * 0.26);
            return 6 + Math.abs(signalA + signalB) * 9;
        });
    }, [elapsedMs, phase]);

    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }} scrollable={false}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="flex-1" style={{ backgroundColor: mutedColor }}>
                <View className="flex-1 px-5 pt-4">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                            <SessionHeader
                                displayName={displayName}
                                onChangeDisplayName={setDisplayName}
                                textColor={textColor}
                                mutedTextColor={mutedTextColor}
                                headerAtMs={headerAtMs}
                            />
                        </View>
                        <Pressable
                            onPress={openRemarkSheet}
                            className="mt-1 flex-row items-center gap-1 rounded-full px-2 py-1"
                            style={{ backgroundColor: cardColor }}>
                            <DesignPencil width={16} height={16} color={textColor} />
                            <TextX className="text-xs" style={{ color: textColor }}>
                                编辑
                            </TextX>
                        </Pressable>
                    </View>

                    <View className="items-center pt-12">
                        <View className="flex-row items-end">
                            <TextX className="text-7xl font-light" style={{ color: mutedTextColor, fontVariant: ['tabular-nums'] }}>
                                {timerDisplay.muted}
                            </TextX>
                            <TextX className="text-7xl font-medium" style={{ color: textColor, fontVariant: ['tabular-nums'] }}>
                                {timerDisplay.focus}
                            </TextX>
                        </View>
                    </View>

                    <View className="flex-1 pt-12">
                        <View className="flex-row justify-between px-1">
                            {RULER_LABELS.map(label => (
                                <TextX key={label} className="text-2xl" style={{ color: mutedTextColor, fontVariant: ['tabular-nums'] }}>
                                    {label}
                                </TextX>
                            ))}
                        </View>

                        <View className="mt-2 flex-row items-end justify-between px-1">
                            {Array.from({ length: RULER_TICK_COUNT }, (_, index) => (
                                <View
                                    key={`tick-${index}`}
                                    style={{
                                        width: 1,
                                        height: index % 4 === 0 ? 16 : 8,
                                        borderRadius: 99,
                                        backgroundColor: mutedTextColor,
                                        opacity: index % 4 === 0 ? 0.7 : 0.35,
                                    }}
                                />
                            ))}
                        </View>

                        <View className="mt-6 flex-1">
                            <View
                                pointerEvents="none"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: '50%',
                                    width: 1,
                                    backgroundColor: '#ef4444',
                                    transform: [{ translateX: -0.5 }],
                                }}
                            />

                            <View className="mt-20 flex-row items-center justify-between">
                                {waveHeights.map((height, index) => {
                                    const beforeCenter = index < WAVE_CENTER_INDEX;
                                    return (
                                        <View
                                            key={`wave-${index}`}
                                            style={{
                                                width: 3,
                                                height,
                                                borderRadius: 999,
                                                backgroundColor: beforeCenter ? textColor : mutedTextColor,
                                                opacity: beforeCenter ? 0.95 : 0.45,
                                            }}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                </View>

                <View className="flex-shrink-0 px-6 pb-5 pt-3" style={{ backgroundColor: mutedColor }}>
                    <View className="mb-3 items-center">
                        <TextX style={{ color: mutedTextColor }}>标记数 {markerTimestamps.length}</TextX>
                    </View>

                    <View className="flex-row items-center justify-between">
                        <IconButton
                            circular
                            size={72}
                            backgroundColor={cardColor}
                            disabled={!canStop || isStopping}
                            onPress={handleAddMarker}
                            icon={Flag}
                            iconProps={{ color: textColor }}
                        />

                        <IconButton
                            circular
                            size={88}
                            backgroundColor={canStop ? destructiveColor : cardColor}
                            disabled={!canStop || isStopping}
                            onPress={handleConfirmStop}
                            icon={Square}
                            iconProps={{ color: canStop ? destructiveForegroundColor : mutedTextColor }}
                        />

                        <IconButton
                            circular
                            size={72}
                            backgroundColor={isIdleLike ? cardColor : primaryColor}
                            disabled={actionLoading || isStopping}
                            onPress={isIdleLike ? handleBackPress : handleLeftAction}
                            icon={isIdleLike ? ArrowLeft : isPaused ? PlayIcon : PauseIcon}
                            iconProps={{ color: isIdleLike ? textColor : primaryForegroundColor }}
                        />
                    </View>

                    <View className="mt-3 items-center">
                        <TextX style={{ color: mutedTextColor, fontVariant: ['tabular-nums'] }}>
                            {isIdleLike ? '点击中间按钮开始录音' : `录音中 ${elapsedText}`}
                        </TextX>
                    </View>

                    <BottomSafeAreaSpacer />
                </View>
            </View>

            <BottomSheet
                isVisible={isRemarkSheetVisible}
                onClose={closeRemarkSheet}
                title="灵感速记"
                snapPoints={[0.55, 0.78]}
                disablePanGesture={false}>
                <View className="h-[320px]">
                    <RichNoteEditor
                        key="record-remark-editor"
                        placeholder="输入灵感速记"
                        inputRef={noteInputRef}
                        initialText={remarkText}
                        onTextChange={handleRemarkTextChange}
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
        </DefaultLayout>
    );
}
