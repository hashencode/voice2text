import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import { InternalizationExample } from 'components/InternalizationExample';

export default function Modal() {
    return (
        <>
            <InternalizationExample />

            <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
        </>
    );
}
