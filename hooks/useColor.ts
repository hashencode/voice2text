import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/theme/colors';

type UseColorOptions = {
    light?: string;
    dark?: string;
    reverse?: boolean;
};

export function useColor(colorName: keyof typeof Colors.light & keyof typeof Colors.dark, props?: UseColorOptions) {
    const colorScheme = useColorScheme();
    const currentTheme = colorScheme === 'dark' ? 'dark' : 'light';
    const theme = props?.reverse ? (currentTheme === 'dark' ? 'light' : 'dark') : currentTheme;
    const colorFromProps = props?.[theme];

    if (colorFromProps) {
        return colorFromProps;
    } else {
        return Colors[theme][colorName];
    }
}
