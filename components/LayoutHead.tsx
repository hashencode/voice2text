import { useNavigation } from '@react-navigation/native';
import { useThrottleFn } from 'ahooks';
import classNames from 'classnames';
import { ArrowLeft } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { TextX } from '~/components/ui/text';

export interface IHeadProps {
    backIcon?: ReactNode; // 返回按钮图标
    extra?: ReactNode; // 额外节点
    hideBack?: boolean; // 隐藏返回按钮
    subtitle?: ReactNode; // 副标题
    title?: ReactNode; // 标题

    styles?: {
        root?: string; // 根节点样式
        body?: string; // 主体节点样式
        backIcon?: StyleProp<ViewStyle>; // 返回图标样式
        title?: string; // 标题样式
        subtitle?: string; // 副标题样式
    }; // 样式

    onBack?: () => void; // 返回按钮点击事件回调
}

export default function LayoutHead(props: IHeadProps) {
    const { backIcon, hideBack, title, subtitle, extra, styles, onBack } = props;

    const navigation = useNavigation();

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
        <View className={classNames('flex h-14 w-full flex-row items-center justify-between bg-white', styles?.root)}>
            {!hideBack ? (
                <Pressable className="absolute left-2 top-1/2 z-20 -translate-y-1/2" hitSlop={20} onPress={handleGoBack}>
                    {backIcon || <ArrowLeft size={26} style={styles?.backIcon} />}
                </Pressable>
            ) : null}

            <View className={classNames('z-10 flex w-full flex-col items-center justify-center gap-x-1 px-14', styles?.body)}>
                <TextX variant="title" className={classNames('line-clamp-1 w-full text-center', styles?.title)}>
                    {title}
                </TextX>
                {subtitle ? (
                    <TextX variant="description" className={classNames('line-clamp-1 w-full text-center text-secondary', styles?.subtitle)}>
                        {subtitle}
                    </TextX>
                ) : null}
            </View>

            <View className="absolute right-2 top-1/2 z-20 -translate-y-1/2">{extra}</View>
        </View>
    );
}
