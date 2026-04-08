import { useRouter } from 'expo-router';
import { DesignPencil, Microphone, MultiBubble, MusicDoubleNotePlus } from 'iconoir-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';
import { TextX } from '~/components/ui/textx';
import { useToast } from '~/components/ui/toast';
import { useFilePicker } from '~/hooks/useFilePicker';
import { useColor } from '~/hooks/useColor';
import * as FileSystem from 'expo-file-system/legacy';

export default function HomeEntrance() {
    const router = useRouter();
    const { toast } = useToast();
    const iconColor = useColor('text');
    const { pickDocument } = useFilePicker({
        multiple: false,
        onError: error => {
            toast({
                title: '导入失败',
                description: error,
                variant: 'error',
                duration: 3000,
            });
        },
    });

    const handleImportAudio = React.useCallback(async () => {
        const selectedFiles = await pickDocument({ multiple: false });
        const selectedFile = selectedFiles[0];
        if (!selectedFile?.uri) {
            return;
        }

        try {
            const fileInfo = await FileSystem.getInfoAsync(selectedFile.uri);
            if (!fileInfo.exists) {
                toast({
                    title: '导入失败',
                    description: '文件不存在或无法访问',
                    variant: 'error',
                    duration: 3000,
                });
                return;
            }
        } catch (error) {
            toast({
                title: '导入失败',
                description: (error as Error).message ?? '读取文件失败',
                variant: 'error',
                duration: 3000,
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
    }, [pickDocument, router, toast]);

    const headTab = [
        { icon: <Microphone width={36} height={36} color={iconColor} />, label: '录音', onPress: () => router.push('/record') },
        { icon: <DesignPencil width={36} height={36} color={iconColor} />, label: '灵感速记' },
        { icon: <MultiBubble width={36} height={36} color={iconColor} />, label: '会议记录' },
        { icon: <MusicDoubleNotePlus width={36} height={36} color={iconColor} />, label: '导入音频', onPress: handleImportAudio },
    ];

    return (
        <View className="flex flex-row justify-between px-6 py-4">
            {headTab.map(({ icon, label, onPress }) => {
                return (
                    <Pressable className="flex items-center gap-y-1.5" key={label} onPress={onPress}>
                        {icon}
                        <TextX variant="description" className="font-medium">
                            {label}
                        </TextX>
                    </Pressable>
                );
            })}
        </View>
    );
}
