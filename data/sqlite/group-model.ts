export const SYSTEM_GROUPS = {
    all: 'all',
    meeting: 'meeting',
    recentlyDeleted: 'recently_deleted',
} as const;

export type SystemGroupId = (typeof SYSTEM_GROUPS)[keyof typeof SYSTEM_GROUPS];
export type RecordingGroupId = SystemGroupId | string;

export const SYSTEM_GROUP_LABELS: Record<SystemGroupId, string> = {
    [SYSTEM_GROUPS.all]: '全部录音',
    [SYSTEM_GROUPS.meeting]: '会议录音',
    [SYSTEM_GROUPS.recentlyDeleted]: '最近删除',
};

export function isSystemGroupId(groupId: string): groupId is SystemGroupId {
    return groupId === SYSTEM_GROUPS.all || groupId === SYSTEM_GROUPS.meeting || groupId === SYSTEM_GROUPS.recentlyDeleted;
}

export function isReservedGroupName(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    return normalized === SYSTEM_GROUPS.all || normalized === SYSTEM_GROUPS.meeting || normalized === SYSTEM_GROUPS.recentlyDeleted;
}

export function getGroupLabel(groupId: string): string {
    if (isSystemGroupId(groupId)) {
        return SYSTEM_GROUP_LABELS[groupId];
    }
    return groupId;
}
