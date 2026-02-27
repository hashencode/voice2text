import { Image } from 'expo-image';
import React from 'react';
import { View } from 'react-native';
import { Button } from '~/components/ui/button';

export default function BlockAddPet() {
    return (
        <View className="px-3">
            <View className="rounded-xl bg-white p-3 shadow-xl">
                <Image className="my-5 aspect-[6] w-full rounded-xl" source={require('~/assets/images/banner-add-first-pet.jpg')} />
                <View className="flex flex-row items-center justify-end">
                    <Button>添加您的宠物</Button>
                </View>
            </View>
        </View>
    );
}
