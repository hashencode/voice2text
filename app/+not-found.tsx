import { Link, Stack } from 'expo-router';

import { View } from 'react-native';
import { TextX } from '~/components/ui/text';

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: 'Oops!' }} />
            <View className={styles.container}>
                <TextX className={styles.title}>{"This screen doesn't exist."}</TextX>
                <Link href="/" className={styles.link}>
                    <TextX className={styles.linkText}>Go to home screen!</TextX>
                </Link>
            </View>
        </>
    );
}

const styles = {
    container: `items-center flex-1 justify-center p-5`,
    title: `text-xl font-bold`,
    link: `mt-4 pt-4`,
    linkText: `text-base text-[#2e78b7]`,
};
