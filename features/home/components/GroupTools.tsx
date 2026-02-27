import { Image } from 'expo-image';
import { View } from 'react-native';
import { TextX } from '~/components/ui/text';
import BlockFull from '~/features/home/components/BlockFull';
import BlockHalf from '~/features/home/components/BlockHalf';

export default function GroupTools() {
    return (
        <View className="flex gap-3">
            <View className="flex flex-row justify-between gap-3">
                <BlockFull>
                    <Image
                        className="absolute -bottom-2 left-[5%] aspect-square w-[90%]"
                        source={require('~/assets/images/tools-record.jpg')}
                    />
                    <TextX className="absolute left-3 top-2 font-medium" variant="heading">
                        记录
                    </TextX>
                </BlockFull>

                <View className="flex flex-1 flex-col gap-3">
                    <BlockHalf>
                        <Image
                            className="absolute bottom-0 right-2 aspect-[3/2] h-[84%]"
                            source={require('~/assets/images/tools-creative.jpg')}
                        />
                        <TextX className="absolute left-3 top-3 font-medium" variant="title">
                            创作
                        </TextX>
                    </BlockHalf>

                    <View className="relative flex-1">
                        <BlockHalf>
                            <Image
                                className="absolute bottom-0 right-3 aspect-square h-[84%]"
                                source={require('~/assets/images/tools-warehouse.jpg')}
                            />
                            <TextX className="absolute left-3 top-3 font-medium" variant="title">
                                仓库
                            </TextX>
                        </BlockHalf>
                    </View>
                </View>
            </View>

            <View className="flex flex-row justify-between gap-3">
                <BlockFull className="flex items-center justify-between">
                    <Image className="mt-3 aspect-[1/1] w-[58%]" source={require('~/assets/images/tools-todo.jpg')} />
                    <View className="w-full pb-3 pl-2.5">
                        <TextX className="font-medium">日程</TextX>
                    </View>
                </BlockFull>

                <BlockFull className="flex items-center justify-between">
                    <Image className="mt-3 aspect-[1/1] w-[58%]" source={require('~/assets/images/tools-health.jpg')} />
                    <View className="w-full pb-3 pl-2.5">
                        <TextX className="font-medium">健康档案</TextX>
                    </View>
                </BlockFull>

                <BlockFull className="flex items-center justify-between">
                    <Image className="mt-3 aspect-[1/1] w-[64%]" source={require('~/assets/images/tools-todo.jpg')} />
                    <View className="w-full pb-3 pl-2.5">
                        <TextX className="font-medium">养宠百科</TextX>
                    </View>
                </BlockFull>
            </View>
        </View>
    );
}
