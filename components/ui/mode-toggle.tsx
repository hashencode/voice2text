import { useColor } from '@/hooks/useColor';
import { useModeToggle } from '@/hooks/useModeToggle';
import { Moon, Sun } from 'lucide-react-native';
import { BouncyPressable } from '~/components/ui/bouncy-pressable';

export const ModeToggle = () => {
    const { toggleMode, isDark } = useModeToggle();
    const iconColor = useColor('text');
    const Icon = isDark ? Moon : Sun;

    return (
        <BouncyPressable onPress={toggleMode} hitSlop={8} className="p-3">
            <Icon size={20} color={iconColor} />
        </BouncyPressable>
    );
};
