import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';

// 全局注册
cssInterop(Image, {
    className: 'style',
});
