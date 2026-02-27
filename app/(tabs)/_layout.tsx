import { Tabs } from 'expo-router';

import { Blend, PawPrint, Smile } from 'lucide-react-native';

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
                    tabBarIcon: ({ color }) => <PawPrint color={color} />,
                }}
            />
            <Tabs.Screen
                name="community"
                options={{
                    title: 'Community',
                    tabBarIcon: ({ color }) => <Blend color={color} />,
                }}
            />
            <Tabs.Screen
                name="me"
                options={{
                    title: 'Me',
                    tabBarIcon: ({ color }) => <Smile color={color} />,
                }}
            />
        </Tabs>
    );
}
