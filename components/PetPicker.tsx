import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';
import { TextX } from '~/components/ui/text';

const imgUrl = 'https://cdn.dribbble.com/userupload/45589292/file/f88b8bf99c1e6be04a61b6835adbca2a.png?resize=1504x1128&vertical=center';

export default function PetPicker() {
    return (
        <View className="py-4 pl-3">
            <TextX className="mb-3 text-2xl font-medium">我的宠物</TextX>
            <ScrollView horizontal className="flex">
                {Array(10)
                    .fill('')
                    .map((_, index) => {
                        return (
                            <View className="mr-3 w-20" key={index}>
                                <Image
                                    className="h-20 w-20 rounded-full"
                                    source={{
                                        uri: imgUrl,
                                    }}
                                />
                                <TextX className="mt-1 line-clamp-1 text-center">臭猫</TextX>
                            </View>
                        );
                    })}
            </ScrollView>
        </View>
    );
}
