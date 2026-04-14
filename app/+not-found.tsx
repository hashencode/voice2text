import { Link, Stack } from 'expo-router';

import { View } from 'react-native';
import { TextX } from '~/components/ui/textx';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: '页面未找到' }} />
            <View className={classes.container}>
                <TextX className={classes.title}>当前页面不存在</TextX>
                <Link href="/" className={classes.link}>
                    <TextX className={classes.linkText}>返回首页</TextX>
                </Link>
            </View>
        </>
    );
}

const classes = {
    container: 'items-center flex-1 justify-center p-5',
    title: 'text-xl font-bold',
    link: 'mt-4 pt-4',
    linkText: 'text-base text-[#2e78b7]',
};
