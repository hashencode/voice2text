import { Tabs } from 'expo-router';

import { Home, Smile } from 'lucide-react-native';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: 'black',
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <Home color={color} />,
                }}
            />
            <Tabs.Screen
                name="libs"
                options={{
                    title: 'Libs',
                    tabBarIcon: ({ color }) => <Smile color={color} />,
                }}
            />
        </Tabs>
    );
}
