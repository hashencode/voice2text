export type RecordingMeta = {
    path: string;
    displayName?: string | null;
    sampleRate: number | null;
    numSamples: number | null;
    durationMs: number | null;
    recordedAtMs: number | null;
    sessionId?: string | null;
    reason?: string | null;
};

export type RecordingMetaRow = {
    path: string;
    display_name: string | null;
    sample_rate: number | null;
    num_samples: number | null;
    duration_ms: number | null;
    recorded_at_ms: number | null;
    session_id: string | null;
    reason: string | null;
};
