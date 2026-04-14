export function formatHeaderDate(ms: number): string {
    const date = new Date(ms);
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
}

export function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '00:00';
    }
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, '0');
    const remainSeconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainSeconds}`;
}

export function toDisplayName(rawName?: string | string[]): string {
    const normalizedName = Array.isArray(rawName) ? rawName[0] : rawName;
    if (!normalizedName) {
        return '未命名文件';
    }
    const dotIndex = normalizedName.lastIndexOf('.');
    if (dotIndex <= 0) {
        return normalizedName;
    }
    return normalizedName.slice(0, dotIndex);
}

export function formatImportAudioDefaultName(ms: number): string {
    const date = new Date(ms);
    const year = `${date.getFullYear()}`.slice(-2);
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    return `导入音频-${year}${month}${day}${hour}${minute}`;
}

export function formatSpeed(speed: number): string {
    return (Math.round(speed * 10) / 10).toFixed(1);
}
