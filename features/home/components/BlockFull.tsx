import { PropsWithChildren } from 'react';
import { GestureResponderEvent, Pressable } from 'react-native';

interface IBlockFullProps extends PropsWithChildren {
    onPress?: ((event: GestureResponderEvent) => void) | null | undefined;
    className?: string;
}

export default function BlockFull(props: IBlockFullProps) {
    return (
        <Pressable
            className={`aspect-square flex-1 overflow-hidden rounded-xl bg-white shadow-lg ${props?.className || ''}`}
            onPress={props.onPress}>
            {props.children}
        </Pressable>
    );
}
