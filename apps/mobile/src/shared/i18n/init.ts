// Hermes의 Intl.PluralRules 플랫폼 편차를 제거하기 위해 항상 폴리필을 로드한다
import 'intl-pluralrules';
import { FALLBACK_LOCALE } from '@aido/api/vocabulary';
import { getDeviceLanguage } from '@src/shared/infra/localization/device-locale';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import {
  LANGUAGE_MODE_STORAGE_KEY,
  toLanguageMode,
  resolveLanguage,
} from '@src/shared/preferences/language.preference';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from './resources';

const initialLanguage = resolveLanguage(
  toLanguageMode(deviceSyncStorage.get(LANGUAGE_MODE_STORAGE_KEY)),
  getDeviceLanguage(),
);

i18n.use(initReactI18next).init({
  lng: initialLanguage,
  fallbackLng: FALLBACK_LOCALE,
  resources,
  defaultNS: 'common',
  interpolation: {
    // React가 XSS를 방지하므로 이스케이프 불필요
    escapeValue: false,
  },
  returnNull: false,
});
