// Hermes의 Intl.PluralRules 플랫폼 편차를 제거하기 위해 항상 폴리필을 로드한다
import 'intl-pluralrules';
import 'dayjs/locale/ko';
import { mmkvSyncStorage } from '@src/shared/infra/storage/mmkv-storage';
import { readLanguageMode, resolveLanguage } from '@src/shared/preferences/language.preference';
import dayjs from 'dayjs';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getDeviceLanguage } from './device-language';
import { resources } from './resources';

const initialLanguage = resolveLanguage(readLanguageMode(mmkvSyncStorage), getDeviceLanguage());

i18n.use(initReactI18next).init({
  lng: initialLanguage,
  fallbackLng: 'ko',
  resources,
  defaultNS: 'common',
  interpolation: {
    // React가 XSS를 방지하므로 이스케이프 불필요
    escapeValue: false,
  },
  returnNull: false,
});

i18n.on('languageChanged', (language) => {
  dayjs.locale(language);
});

dayjs.locale(initialLanguage);

export { i18n };
