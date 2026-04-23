import { IconButton } from '@/components/ui/icon-button';
import { useModeToggle } from '@/hooks/use-mode-toggle';
import { useColor } from '@/hooks/useColor';
import { Moon, Sun } from 'lucide-react-native';
import type { IconButtonSize } from '~/components/ui/icon-button';

type ModeToggleProps = {
    size?: IconButtonSize;
    backgroundColor?: string;
    className?: string;
};

export const ModeToggle = ({ size = 'default', backgroundColor, className }: ModeToggleProps) => {
    const { toggleMode, isDark } = useModeToggle();
    const iconColor = useColor('text');
    const Icon = isDark ? Moon : Sun;

    return (
        <IconButton
            icon={Icon}
            size={size}
            backgroundColor={backgroundColor}
            className={className}
            iconProps={{ color: iconColor }}
            onPress={toggleMode}
        />
    );
};
