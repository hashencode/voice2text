import React from 'react';
import { ScrollView, View } from 'react-native';
import FileListItem from '~/components/home/FileListItem';
import { Separator } from '~/components/ui/separator';

export default function FileList() {
    return (
        <ScrollView className="px-5">
            <FileListItem />
            <View className="my-4">
                <Separator />
            </View>
            <FileListItem />
        </ScrollView>
    );
}
