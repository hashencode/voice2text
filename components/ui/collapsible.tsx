import { Icon } from '@/components/ui/icon';
import { TextX } from '@/components/ui/textx';
import { View } from '@/components/ui/view';
import { ChevronRight } from 'lucide-react-native';
import { PropsWithChildren, useState } from 'react';
import { TouchableOpacity } from 'react-native';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <View>
            <TouchableOpacity className="flex-row items-center gap-1.5" onPress={() => setIsOpen(value => !value)} activeOpacity={0.8}>
                <Icon name={ChevronRight} size={18} style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }} />

                <TextX variant="subtitle">{title}</TextX>
            </TouchableOpacity>

            {isOpen && <View className="ml-6 mt-1.5">{children}</View>}
        </View>
    );
}
