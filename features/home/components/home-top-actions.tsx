import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { FileInput, Moon, Search, Sun } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { useToast } from '~/components/ui/toast';
import { useColor } from '~/hooks/use-color';
import { useFilePicker } from '~/hooks/use-file-picker';
import { useModeToggle } from '~/hooks/use-mode-toggle';

type HomeTopActionsProps = {
    rightContent?: React.ReactNode;
};

export default function HomeTopActions({ rightContent }: HomeTopActionsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const iconColor = useColor('text');
    const { isDark, toggleMode } = useModeToggle();
    const ModeIcon = isDark ? Moon : Sun;
    const iconProps = {
        size: 24 as const,
        strokeWidth: 1.5,
        color: iconColor,
    };
    const [importing, setImporting] = React.useState(false);
    const { pickDocument } = useFilePicker({
        multiple: false,
        onError: error => {
            toast({
                title: '导入失败',
                description: error,
                variant: 'error',
            });
        },
    });

    const handleImportAudio = React.useCallback(async () => {
        if (importing) {
            return;
        }
        try {
            setImporting(true);
            const selectedFiles = await pickDocument({ multiple: false });
            const selectedFile = selectedFiles[0];
            if (!selectedFile?.uri) {
                return;
            }

            const fileInfo = await FileSystem.getInfoAsync(selectedFile.uri);
            if (!fileInfo.exists) {
                toast({
                    title: '导入失败',
                    description: '文件不存在或无法访问',
                    variant: 'error',
                });
                return;
            }

            router.push({
                pathname: '/import-audio',
                params: {
                    uri: selectedFile.uri,
                    name: selectedFile.name ?? '',
                },
            });
        } catch (error) {
            toast({
                title: '导入失败',
                description: (error as Error).message ?? '读取文件失败',
                variant: 'error',
            });
        } finally {
            setImporting(false);
        }
    }, [importing, pickDocument, router, toast]);

    const defaultNormalRight = (
        <View className="flex flex-row items-center gap-x-8">
            <Search {...iconProps} onPress={() => toast({ title: '搜索功能即将上线', variant: 'info' })} />
            <FileInput {...iconProps} onPress={handleImportAudio} />
            <ModeIcon {...iconProps} onPress={toggleMode} />
        </View>
    );

    return <>{rightContent ?? defaultNormalRight}</>;
}
