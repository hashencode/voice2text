import { ComponentProps } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BottomSafeAreaSpacerProps = ComponentProps<typeof View>;

export function BottomSafeAreaSpacer({ style, ...props }: BottomSafeAreaSpacerProps) {
    const insets = useSafeAreaInsets();

    return <View {...props} style={[{ width: '100%', flexShrink: 0, height: insets.bottom }, style]} />;
}
