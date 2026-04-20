import { useModeToggle } from '@/hooks/use-mode-toggle';
import { useColor } from '@/hooks/useColor';
import { Moon, Sun } from 'lucide-react-native';
import { Pressable } from 'react-native';

export const ModeToggle = () => {
    const { toggleMode, isDark } = useModeToggle();
    const iconColor = useColor('text');
    const Icon = isDark ? Moon : Sun;

    return (
        <Pressable onPress={toggleMode} hitSlop={8} className="p-3">
            <Icon size={20} color={iconColor} />
        </Pressable>
    );
};
