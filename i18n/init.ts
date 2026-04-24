import { createInstance, Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { fallbackChecker } from './fallback-checker';
import { languageDetector } from './language-detector';

type Init18n = {
    resources: Resource;
    fallbackLng: string;
};

export const init18n = ({ resources, fallbackLng }: Init18n) => {
    const i18n = createInstance();
    return i18n
        .use(languageDetector)
        .use(initReactI18next)
        .init({
            resources,
            fallbackLng: fallbackChecker(resources, fallbackLng),
            compatibilityJSON: 'v3', // By default React Native projects does not support Intl
            interpolation: {
                escapeValue: false,
            },
        });
};
