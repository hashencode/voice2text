import { Link, Stack } from 'expo-router';

import { View } from 'react-native';
import { TextX } from '~/components/ui/textx';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <View className={classes.container}>
                <TextX className={classes.title}>This screen doesn&apos;t exist.</TextX>
                <Link href="/" className={classes.link}>
                    <TextX className={classes.linkText}>Go to home screen!</TextX>
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
