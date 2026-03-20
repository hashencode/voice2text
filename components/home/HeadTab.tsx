import { DesignPencil, Microphone, MultiBubble, MusicDoubleNotePlus } from 'iconoir-react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { TextX } from '~/components/ui/textx';

export default function HeadTab() {
    const router = useRouter();
    const headTab = [
        { icon: <Microphone width={36} height={36} />, label: '录音', onPress: () => router.push('/record') },
        { icon: <DesignPencil width={36} height={36} />, label: '灵感速记' },
        { icon: <MultiBubble width={36} height={36} />, label: '会议记录' },
        { icon: <MusicDoubleNotePlus width={36} height={36} />, label: '导入音频' },
    ];

    return (
        <View className="flex flex-row justify-between px-6 py-4">
            {headTab.map(({ icon, label, onPress }) => {
                return (
                    <Pressable className="flex items-center gap-y-1.5" key={label} onPress={onPress}>
                        {icon}
                        <TextX variant="description">{label}</TextX>
                    </Pressable>
                );
            })}
        </View>
    );
}
