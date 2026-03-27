import * as FileSystem from 'expo-file-system/legacy';
import React from 'react';
import { Share as RNShare } from 'react-native';

type ToastApi = {
    toast: (options: { title: string; description?: string; variant?: 'default' | 'success' | 'error' | 'warning' | 'info' }) => void;
};

type UseItemActionsParams = {
    toastApi: ToastApi;
};

export function useItemActions({ toastApi }: UseItemActionsParams) {
    const [sharing, setSharing] = React.useState(false);

    const shareSingleFile = React.useCallback(
        async (selectedPaths: string[]) => {
            if (selectedPaths.length <= 0 || sharing) {
                return;
            }
            if (selectedPaths.length > 1) {
                toastApi.toast({
                    title: '暂不支持多文件分享',
                    description: '请先选择一个文件后再分享',
                    variant: 'warning',
                });
                return;
            }

            const targetPath = selectedPaths[0];

            try {
                setSharing(true);
                const fileInfo = await FileSystem.getInfoAsync(targetPath);
                if (!fileInfo.exists) {
                    toastApi.toast({
                        title: '分享失败',
                        description: '文件不存在或已被删除',
                        variant: 'error',
                    });
                    return;
                }

                await RNShare.share({
                    title: '分享录音文件',
                    url: targetPath,
                    message: targetPath,
                });
            } catch {
                toastApi.toast({
                    title: '分享失败',
                    description: '无法打开系统分享面板，请稍后重试',
                    variant: 'error',
                });
            } finally {
                setSharing(false);
            }
        },
        [sharing, toastApi],
    );

    const notifyFavoriteComingSoon = React.useCallback(() => {
        toastApi.toast({
            title: '收藏功能即将上线',
            variant: 'info',
        });
    }, [toastApi]);

    return {
        sharing,
        shareSingleFile,
        notifyFavoriteComingSoon,
    };
}
