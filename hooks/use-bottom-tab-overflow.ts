import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';

export function useBottomTabOverflow() {
    const tabBarHeight = useBottomTabBarHeight();
    return Platform.OS === 'ios' ? tabBarHeight : 0;
}
