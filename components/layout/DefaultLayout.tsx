import { useNavigation } from '@react-navigation/native';
import { useThrottleFn } from 'ahooks';
import classNames from 'classnames';
import { isString } from 'lodash';
import { ArrowLeft } from 'lucide-react-native';
import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, SafeAreaViewProps, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';

interface IDefaultLayoutProps extends PropsWithChildren {
    safeAreaViewConfig?: SafeAreaViewProps;
    scrollable?: boolean;
    headTitle?: ReactNode;
    headExtra?: ReactNode;
    styles?: {
        safeAreaView?: string;
        safeTop?: string;
        safeBottom?: string;
        mainContent?: string;
    };
}

export const DefaultLayout = (props: IDefaultLayoutProps) => {
    const { headTitle, headExtra, safeAreaViewConfig, scrollable = true, styles = {} } = props;
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();

    const { run: handleGoBack } = useThrottleFn(
        () => {
            navigation.goBack();
        },
        { trailing: false, wait: 500 },
    );

    return (
        <SafeAreaView className={styles.safeAreaView} {...safeAreaViewConfig}>
            {/*顶部安全区域*/}
            <View className={classNames('absolute left-0 top-0 w-full', styles.safeTop)} style={{ height: insets.top }} />

            <View className="flex flex-row justify-between px-4 py-2">
                {isString(headTitle) ? (
                    <ButtonX className="flex-shrink-0" onPress={handleGoBack} icon={ArrowLeft} iconProps={{ style: { marginLeft: -4 } }}>
                        <TextX>{headTitle}</TextX>
                    </ButtonX>
                ) : (
                    headTitle
                )}
                {headExtra}
            </View>

            {/*主体内容*/}
            <View className={classNames('h-full', styles.mainContent)}>
                {scrollable ? (
                    <ScrollView overScrollMode="never">{props.children}</ScrollView>
                ) : (
                    <View className="flex-1">{props.children}</View>
                )}
            </View>
            {/*底部安全区域*/}
            <View className={classNames('absolute bottom-0 left-0 w-full', styles.safeBottom)} style={{ height: insets.bottom }} />
        </SafeAreaView>
    );
};
