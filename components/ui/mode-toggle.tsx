import { ButtonSize, ButtonVariant, ButtonX } from '@/components/ui/buttonx';
import { Icon } from '@/components/ui/icon';
import { useModeToggle } from '@/hooks/useModeToggle';
import { Moon, Sun } from 'lucide-react-native';

type Props = {
    variant?: ButtonVariant;
    size?: ButtonSize;
};

export const ModeToggle = ({ variant = 'outline', size = 'icon' }: Props) => {
    const { toggleMode, isDark } = useModeToggle();

    return (
        <ButtonX variant={variant} size={size} onPress={toggleMode}>
            <Icon name={isDark ? Moon : Sun} size={20} />
        </ButtonX>
    );
};
