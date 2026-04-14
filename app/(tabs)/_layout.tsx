import { Tabs } from 'expo-router';

import { Home, Smile } from 'lucide-react-native';
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
                    title: '首页',
                    tabBarIcon: ({ color }) => <Home color={color} />,
                }}
            />
            <Tabs.Screen
                name="setting"
                options={{
                    title: '设置',
                    tabBarIcon: ({ color }) => <Smile color={color} />,
                }}
            />
        </Tabs>
    );
}
