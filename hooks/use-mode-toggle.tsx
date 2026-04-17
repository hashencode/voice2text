import { Appearance, ColorSchemeName } from 'react-native';
import { useColorScheme } from '~/hooks/useColorScheme';

type Mode = 'light' | 'dark' | 'system';

interface UseModeToggleReturn {
    isDark: boolean;
    mode: Mode;
    setMode: (mode: Mode) => void;
    currentMode: ColorSchemeName;
    toggleMode: () => void;
}

export function useModeToggle(): UseModeToggleReturn {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const mode: Mode = colorScheme === 'dark' ? 'dark' : colorScheme === 'light' ? 'light' : 'system';

    const toggleMode = () => {
        Appearance.setColorScheme(isDark ? 'light' : 'dark');
    };

    const setMode = (newMode: Mode) => {
        if (newMode === 'system') {
            Appearance.setColorScheme('unspecified'); // Reset to system default
        } else {
            Appearance.setColorScheme(newMode);
        }
    };

    return {
        isDark,
        mode,
        setMode,
        currentMode: colorScheme,
        toggleMode,
    };
}
