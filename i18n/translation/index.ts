import { init18n } from '~/i18n/init';
import en from '~/i18n/translation/en.json';

export const resources = {
    en: {
        translation: en,
    },
};

export const fallbackLng = 'en';

export type LanguageCode = keyof typeof resources;

const i18n = init18n({ resources, fallbackLng });

export default i18n;
