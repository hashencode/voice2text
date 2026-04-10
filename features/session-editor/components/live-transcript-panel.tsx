import React from 'react';
import { View } from 'react-native';
import { TextX } from '~/components/ui/textx';
import type { EditorTabValue } from '~/features/session-editor/types';
import type { RealtimeAsrUpdateEvent } from '~/modules/sherpa';
import SherpaOnnx from '~/modules/sherpa';

const TRANSCRIPT_MUTABLE_TAIL_CHARS = 120;
const TRANSCRIPT_RENDER_WINDOW_MS = 30_000;

type Props = {
    phase: 'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'error';
    editorTab: EditorTabValue;
    recordingEndedAtMs: number | null;
    textColor: string;
    mutedTextColor: string;
};

function splitStableAndTailText(fullText: string, previousFullText: string, previousStableLength: number) {
    const candidateStableLength = Math.max(0, fullText.length - TRANSCRIPT_MUTABLE_TAIL_CHARS);
    let nextStableLength = Math.max(previousStableLength, candidateStableLength);

    const previousStableText = previousFullText.slice(0, previousStableLength);
    if (!fullText.startsWith(previousStableText)) {
        let lcp = 0;
        const limit = Math.min(previousFullText.length, fullText.length);
        while (lcp < limit && previousFullText.charCodeAt(lcp) === fullText.charCodeAt(lcp)) {
            lcp += 1;
        }
        nextStableLength = Math.max(0, Math.min(candidateStableLength, lcp));
    }

    nextStableLength = Math.min(nextStableLength, fullText.length);

    return {
        stablePrefix: fullText.slice(0, nextStableLength),
        liveTail: fullText.slice(nextStableLength),
        stableLength: nextStableLength,
    };
}

export default function LiveTranscriptPanel({ phase, editorTab, recordingEndedAtMs, textColor, mutedTextColor }: Props) {
    const [renderTick, setRenderTick] = React.useState(0);
    const [updatedAtMs, setUpdatedAtMs] = React.useState<number | null>(null);
    const [stablePrefix, setStablePrefix] = React.useState('');
    const [liveTail, setLiveTail] = React.useState('');
    const latestSnapshotRef = React.useRef<RealtimeAsrUpdateEvent | null>(null);
    const previousFullTextRef = React.useRef('');
    const stableLengthRef = React.useRef(0);

    const isTranscriptTabActive = editorTab === 'transcript';
    const isRecordingWindow = phase === 'recording' || phase === 'paused' || phase === 'stopping';
    const isRecentTailWindow = recordingEndedAtMs !== null && Date.now() - recordingEndedAtMs <= TRANSCRIPT_RENDER_WINDOW_MS;
    const shouldRenderRealtime = isTranscriptTabActive && (isRecordingWindow || isRecentTailWindow);

    const applySnapshotToView = React.useCallback((snapshot: RealtimeAsrUpdateEvent | null) => {
        if (!snapshot) {
            setStablePrefix('');
            setLiveTail('');
            setUpdatedAtMs(null);
            previousFullTextRef.current = '';
            stableLengthRef.current = 0;
            return;
        }

        const fullText = snapshot.text.trim();
        if (!fullText) {
            setStablePrefix('');
            setLiveTail('');
            setUpdatedAtMs(snapshot.updatedAtMs > 0 ? snapshot.updatedAtMs : null);
            previousFullTextRef.current = '';
            stableLengthRef.current = 0;
            return;
        }

        const split = splitStableAndTailText(fullText, previousFullTextRef.current, stableLengthRef.current);
        previousFullTextRef.current = fullText;
        stableLengthRef.current = split.stableLength;
        setStablePrefix(split.stablePrefix);
        setLiveTail(split.liveTail);
        setUpdatedAtMs(snapshot.updatedAtMs > 0 ? snapshot.updatedAtMs : Date.now());
    }, []);

    React.useEffect(() => {
        const subscription = SherpaOnnx.addRealtimeAsrListener(event => {
            latestSnapshotRef.current = event;
            if (shouldRenderRealtime) {
                applySnapshotToView(event);
            }
        });
        return () => {
            subscription.remove();
        };
    }, [applySnapshotToView, shouldRenderRealtime]);

    React.useEffect(() => {
        if (!recordingEndedAtMs || !isTranscriptTabActive || isRecordingWindow) {
            return;
        }
        const remainingMs = TRANSCRIPT_RENDER_WINDOW_MS - (Date.now() - recordingEndedAtMs);
        if (remainingMs <= 0) {
            return;
        }
        const timer = setTimeout(() => {
            setRenderTick(value => value + 1);
        }, remainingMs + 50);
        return () => {
            clearTimeout(timer);
        };
    }, [isRecordingWindow, isTranscriptTabActive, recordingEndedAtMs]);

    React.useEffect(() => {
        if (shouldRenderRealtime) {
            applySnapshotToView(latestSnapshotRef.current);
        }
    }, [applySnapshotToView, renderTick, shouldRenderRealtime]);

    const fullText = `${stablePrefix}${liveTail}`.trim();
    const statusText = isRecordingWindow
        ? phase === 'paused'
            ? '暂停中，正在收尾转写...'
            : phase === 'stopping'
              ? '正在结束录音，收尾转写中...'
              : '实时转写中...'
        : isRecentTailWindow
          ? '录音结束，正在处理最后一段转写...'
          : '实时转写未运行';

    return (
        <View className="gap-3 py-2">
            <TextX style={{ color: mutedTextColor }}>{statusText}</TextX>
            {updatedAtMs ? <TextX style={{ color: mutedTextColor }}>最近更新：{Math.max(0, Math.floor((Date.now() - updatedAtMs) / 1000))} 秒前</TextX> : null}
            <TextX style={{ color: fullText ? textColor : mutedTextColor }}>{fullText || '录音后这里会显示实时转写内容'}</TextX>
        </View>
    );
}
