import { Tabs } from 'expo-router';

import { Home, List, Smile } from 'lucide-react-native';
import { useColor } from '~/hooks/useColor';

export default function TabLayout() {
    const iconColor = useColor('text');

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: iconColor,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <Home color={color} />,
                }}
            />
            <Tabs.Screen
                name="setting"
                options={{
                    title: 'Setting',
                    tabBarIcon: ({ color }) => <Smile color={color} />,
                }}
            />
            <Tabs.Screen
                name="wav"
                options={{
                    title: 'WAV',
                    tabBarIcon: ({ color }) => <List color={color} />,
                }}
            />
        </Tabs>
    );
}
