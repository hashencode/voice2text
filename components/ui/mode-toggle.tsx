import { ButtonSize, ButtonVariant, ButtonX } from '@/components/ui/buttonx';
import { useModeToggle } from '@/hooks/useModeToggle';
import { Moon, Sun } from 'lucide-react-native';

type Props = {
    variant?: ButtonVariant;
    size?: ButtonSize;
};

export const ModeToggle = ({ variant = 'outline', size = 'default' }: Props) => {
    const { toggleMode, isDark } = useModeToggle();

    return <ButtonX icon={isDark ? Moon : Sun} variant={variant} size={size} onPress={toggleMode} />;
};
