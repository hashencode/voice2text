import { PropsWithChildren } from 'react';
import { GestureResponderEvent, Pressable } from 'react-native';

interface IBlockFullProps extends PropsWithChildren {
    onPress?: ((event: GestureResponderEvent) => void) | null | undefined;
    className?: string;
}

export default function BlockHalf(props: IBlockFullProps) {
    return (
        <Pressable
            className={`h-full w-full flex-1 overflow-hidden rounded-xl bg-white shadow-lg ${props?.className || ''}`}
            onPress={props.onPress}>
            {props.children}
        </Pressable>
    );
}
