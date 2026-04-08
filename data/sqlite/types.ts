export type RecordingMeta = {
    path: string;
    displayName?: string | null;
    isFavorite?: boolean;
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
    is_favorite: number;
    sample_rate: number | null;
    num_samples: number | null;
    duration_ms: number | null;
    recorded_at_ms: number | null;
    session_id: string | null;
    reason: string | null;
};

export type Folder = {
    name: string;
    createdAtMs: number;
    isFavorite: boolean;
};

export type FolderRow = {
    name: string;
    created_at_ms: number;
    is_favorite: number;
};
