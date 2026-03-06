import { useColor } from '@/hooks/useColor';
import React from 'react';

import { Switch as RNSwitch, SwitchProps as RNSwitchProps } from 'react-native';

export function SwitchX(props: RNSwitchProps) {
    const mutedColor = useColor('muted');

    return <RNSwitch trackColor={{ false: mutedColor, true: '#7DD87D' }} thumbColor={props.value ? '#ffffff' : '#f4f3f4'} {...props} />;
}
