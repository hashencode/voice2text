import { isNumber } from 'lodash';

/**
 * 计算距离目标时间戳还剩多久
 * @param targetTimestamp 目标时间戳（毫秒）
 */
export function calcTimeLeft(targetTimestamp: number): {
    value: number;
    unit: '天' | '小时';
} {
    if (!isNumber(targetTimestamp)) return { value: 0, unit: '小时' };
    const now = Date.now();
    const diff = targetTimestamp - now;

    // 已过期
    if (diff <= 0) {
        return {
            value: 0,
            unit: '小时',
        };
    }

    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;

    if (diff >= dayMs) {
        return {
            value: Math.ceil(diff / dayMs),
            unit: '天',
        };
    }

    return {
        value: Math.ceil(diff / hourMs),
        unit: '小时',
    };
}
