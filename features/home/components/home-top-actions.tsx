import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { FileInput, Search } from 'lucide-react-native';
import React from 'react';
import { LayoutRectangle, View } from 'react-native';
import { IconButton } from '~/components/ui/icon-button';
import { ModeToggle } from '~/components/ui/mode-toggle';
import { useToast } from '~/components/ui/toast';
import { useFilePicker } from '~/hooks/use-file-picker';
import { useColor } from '~/hooks/useColor';

type HomeTopActionsProps = {
    onDockLayout?: (layout: LayoutRectangle) => void;
    onHeightChange?: (height: number) => void;
};

export default function HomeTopActions({ onDockLayout, onHeightChange }: HomeTopActionsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const iconColor = useColor('text');
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

    const lastHeightRef = React.useRef<number | null>(null);
    const lastDockRef = React.useRef<LayoutRectangle | null>(null);

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

    const handleContainerLayout = React.useCallback(
        (height: number) => {
            if (lastHeightRef.current === height) {
                return;
            }
            lastHeightRef.current = height;
            onHeightChange?.(height);
        },
        [onHeightChange],
    );

    const handleDockLayout = React.useCallback(
        (layout: LayoutRectangle) => {
            const prev = lastDockRef.current;
            if (prev && prev.x === layout.x && prev.y === layout.y && prev.width === layout.width && prev.height === layout.height) {
                return;
            }
            lastDockRef.current = layout;
            onDockLayout?.(layout);
        },
        [onDockLayout],
    );

    return (
        <View
            className="flex-row items-center gap-x-2 px-4 pb-2 pt-4"
            onLayout={event => {
                handleContainerLayout(event.nativeEvent.layout.height);
            }}>
            <View
                className="min-h-10 flex-1 justify-center"
                onLayout={event => {
                    handleDockLayout(event.nativeEvent.layout);
                }}
            />
            <View className="flex-row items-center gap-x-2">
                <IconButton
                    icon={Search}
                    size="lg"
                    backgroundColor="transparent"
                    iconProps={{ color: iconColor }}
                    onPress={() => toast({ title: '搜索功能即将上线', variant: 'info' })}
                />
                <IconButton
                    icon={FileInput}
                    size="lg"
                    disabled={importing}
                    backgroundColor="transparent"
                    iconProps={{ color: iconColor }}
                    onPress={handleImportAudio}
                />
                <ModeToggle size="lg" backgroundColor="transparent" />
            </View>
        </View>
    );
}
