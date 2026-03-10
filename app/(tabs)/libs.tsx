import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { DefaultLayout } from '~/components/DefaultLayout';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { TextX } from '~/components/ui/text';

const BADGE_VARIANTS = ['default', 'primary', 'secondary', 'destructive', 'outline', 'ghost', 'success'] as const;
const BUTTON_VARIANTS = ['default', 'primary', 'destructive', 'success', 'outline', 'secondary', 'ghost', 'link'] as const;

export default function Libs() {
    return (
        <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={{ gap: 12, padding: 16 }}>
                <TextX variant="subtitle">Button Variants</TextX>
                <View style={{ gap: 10 }}>
                    {BUTTON_VARIANTS.map(variant => (
                        <Button key={variant} variant={variant}>
                            {variant}
                        </Button>
                    ))}
                </View>
                <TextX variant="subtitle">Badge Variants</TextX>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {BADGE_VARIANTS.map(variant => (
                        <Badge key={variant} variant={variant}>
                            {variant}
                        </Badge>
                    ))}
                </View>
            </View>
        </DefaultLayout>
    );
}
