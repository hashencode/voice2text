import classNames from 'classnames';
import { isString } from 'lodash';
import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, SafeAreaViewProps, useSafeAreaInsets } from 'react-native-safe-area-context';
import LayoutHead from '~/components/LayoutHead';

interface IDefaultLayoutProps extends PropsWithChildren {
    safeAreaViewConfig?: SafeAreaViewProps;
    scrollable?: boolean;
    head?: ReactNode;
    styles?: {
        safeAreaView?: string;
        safeTop?: string;
        safeBottom?: string;
        mainContent?: string;
    };
}

export const DefaultLayout = (props: IDefaultLayoutProps) => {
    const { head, safeAreaViewConfig, scrollable = true, styles = {} } = props;
    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView className={classNames('bg-[#f7f7f7]', styles.safeAreaView)} {...safeAreaViewConfig}>
            {/*顶部安全区域*/}
            <View
                className={classNames('absolute left-0 top-0 w-full', { 'bg-white': head }, styles.safeTop)}
                style={{ height: insets.top }}
            />
            {isString(head) ? <LayoutHead title={head} /> : head}
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
