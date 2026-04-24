import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/use-color';
import { CORNERS } from '@/theme/globals';
import { TextStyle, ViewStyle } from 'react-native';
import { TextX } from '~/components/ui/textx';

type BadgeVariant = 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'success';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export function Badge({ children, variant = 'default', style, textStyle }: BadgeProps) {
    const defaultColor = useColor('background');
    const defaultTextColor = useColor('text');
    const textColor = useColor('text');
    const primaryColor = useColor('primary');
    const primaryForegroundColor = useColor('primaryForeground');
    const outlineColor = useColor('text', { reverse: true });
    const secondaryColor = useColor('secondary');
    const secondaryForegroundColor = useColor('secondaryForeground');
    const destructiveColor = useColor('destructive');
    const destructiveForegroundColor = useColor('destructiveForeground');
    const borderColor = useColor('border');
    const successColor = useColor('green');

    const getBadgeStyle = (): ViewStyle => {
        const baseStyle: ViewStyle = {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 4,
            paddingHorizontal: 12,
            borderRadius: CORNERS,
            borderWidth: 1,
        };

        switch (variant) {
            case 'primary':
                return { ...baseStyle, borderColor: primaryColor, backgroundColor: primaryColor };
            case 'secondary':
                return { ...baseStyle, borderColor: secondaryColor, backgroundColor: secondaryColor };
            case 'destructive':
                return { ...baseStyle, borderColor: destructiveColor, backgroundColor: destructiveColor };
            case 'success':
                return { ...baseStyle, borderColor: successColor, backgroundColor: successColor };
            case 'outline':
                return {
                    ...baseStyle,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor,
                };
            case 'ghost':
                return {
                    ...baseStyle,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: outlineColor,
                };
            default:
                return { ...baseStyle, borderColor: borderColor, backgroundColor: defaultColor };
        }
    };

    const getTextStyle = (): TextStyle => {
        const baseTextStyle: TextStyle = {
            textAlign: 'center',
        };

        switch (variant) {
            case 'primary':
                return { ...baseTextStyle, color: primaryForegroundColor };
            case 'secondary':
                return { ...baseTextStyle, color: secondaryForegroundColor };
            case 'destructive':
                return { ...baseTextStyle, color: destructiveForegroundColor };
            case 'success':
                return { ...baseTextStyle, color: destructiveForegroundColor };
            case 'outline':
                return { ...baseTextStyle, color: textColor };
            case 'ghost':
                return { ...baseTextStyle, color: outlineColor };
            default:
                return { ...baseTextStyle, color: defaultTextColor };
        }
    };

    return (
        <View style={[getBadgeStyle(), style]}>
            <TextX variant="description" style={[getTextStyle(), textStyle]}>
                {children}
            </TextX>
        </View>
    );
}
