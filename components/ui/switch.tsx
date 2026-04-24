import { useColor } from '@/hooks/use-color';
import React from 'react';

import { Switch as RNSwitch, SwitchProps as RNSwitchProps } from 'react-native';

export function SwitchX(props: RNSwitchProps) {
    const mutedColor = useColor('muted');
    const activeColor = useColor('primary');

    return <RNSwitch trackColor={{ false: mutedColor, true: activeColor }} thumbColor={props.value ? '#ffffff' : '#f4f3f4'} {...props} />;
}
