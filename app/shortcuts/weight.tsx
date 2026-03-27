import { Stack } from 'expo-router';

import { DefaultLayout } from '~/components/layout/default-layout';

export default function Weight() {
    return (
        <DefaultLayout head="weight" safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
        </DefaultLayout>
    );
}
