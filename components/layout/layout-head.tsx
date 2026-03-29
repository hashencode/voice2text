import { useThrottleFn } from 'ahooks';
import { useNavigation } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ReactNode } from 'react';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';
import { useColor } from '~/hooks/useColor';

export interface IHeadProps {
    title?: ReactNode; // 标题
    onBack?: () => void; // 返回按钮点击事件回调
}

export default function LayoutHead(props: IHeadProps) {
    const { title, onBack } = props;

    const navigation = useNavigation();
    const cardColor = useColor('card');
    const iconColor = useColor('text');

    const { run: handleGoBack } = useThrottleFn(
        () => {
            if (onBack) {
                onBack();
            } else {
                navigation.goBack();
            }
        },
        { trailing: false, wait: 500 },
    );

    return (
        <ButtonX style={{ backgroundColor: cardColor }} onPress={handleGoBack}>
            <ArrowLeft size={26} color={iconColor} />

            <TextX variant="title" className="line-clamp-1 w-full text-center">
                {title}
            </TextX>
        </ButtonX>
    );
}
