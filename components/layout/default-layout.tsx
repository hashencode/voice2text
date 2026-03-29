import { useThrottleFn } from 'ahooks';
import { useNavigation } from 'expo-router';
import { isString } from 'lodash';
import { ArrowLeft } from 'lucide-react-native';
import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { SafeAreaView, SafeAreaViewProps, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ButtonX } from '~/components/ui/buttonx';
import { TextX } from '~/components/ui/textx';

interface IDefaultLayoutProps extends PropsWithChildren {
    safeAreaViewConfig?: SafeAreaViewProps;
    scrollable?: boolean;
    headTitle?: ReactNode;
    headExtra?: ReactNode;
    styles?: {
        safeAreaView?: StyleProp<ViewStyle>;
        safeTop?: StyleProp<ViewStyle>;
        safeBottom?: StyleProp<ViewStyle>;
        mainContent?: StyleProp<ViewStyle>;
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
        <SafeAreaView className="flex-1" style={styles.safeAreaView} {...safeAreaViewConfig}>
            {/*顶部安全区域*/}
            <View className="absolute left-0 top-0 w-full" style={[{ height: insets.top }, styles.safeTop]} />

            {headTitle || headExtra ? (
                <View className="flex flex-row justify-between px-4 py-2">
                    {isString(headTitle) ? (
                        <ButtonX
                            className="flex-shrink-0"
                            onPress={handleGoBack}
                            icon={ArrowLeft}
                            iconProps={{ style: { marginLeft: -4 } }}>
                            <TextX>{headTitle}</TextX>
                        </ButtonX>
                    ) : (
                        headTitle
                    )}
                    {headExtra}
                </View>
            ) : null}

            {/*主体内容*/}
            <View className="flex-1" style={styles.mainContent}>
                {scrollable ? (
                    <ScrollView overScrollMode="never" contentContainerStyle={{ flexGrow: 1 }}>
                        {props.children}
                    </ScrollView>
                ) : (
                    <View className="flex-1">{props.children}</View>
                )}
            </View>

            {/*底部安全区域*/}
            <View className="absolute bottom-0 left-0 w-full" style={[{ height: insets.bottom }, styles.safeBottom]} />
        </SafeAreaView>
    );
};
