import { DefaultLayout } from '~/components/DefaultLayout';

export default function Home() {
    return <DefaultLayout safeAreaViewConfig={{ edges: ['top', 'left', 'right'] }}></DefaultLayout>;
}
