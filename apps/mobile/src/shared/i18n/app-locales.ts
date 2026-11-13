import {
  FALLBACK_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type TIME_FORMATS,
} from '@aido/api/vocabulary';
import type { SpeechLocale } from '@src/core/ports/speech-recognizer';

interface AppLocaleConfig {
  /** 언어 고르기에 쓰는 그 언어의 이름. 번역하지 않는다 */
  nativeName: string;
  /** Intl 날짜·숫자 표시 */
  intlLocale: string;
  /** 말로 입력·메모의 기본 인식 언어 */
  speechLocale: SpeechLocale;
  /** 네이티브 시간 피커(12시간제) */
  pickerLocale: string;
}

export const APP_LOCALES = {
  ko: { nativeName: '한국어', intlLocale: 'ko-KR', speechLocale: 'ko-KR', pickerLocale: 'ko' },
  en: { nativeName: 'English', intlLocale: 'en-US', speechLocale: 'en-US', pickerLocale: 'en_US' },
} as const satisfies Record<SupportedLocale, AppLocaleConfig>;

export type AppLocale = (typeof APP_LOCALES)[SupportedLocale];
export type IntlLocale = AppLocale['intlLocale'];

// 24시간제는 오전/오후 없는 스피너를 쓰려고 언어와 무관하게 en_GB로 둔다
const TWENTY_FOUR_HOUR_PICKER_LOCALE = 'en_GB';

export function getTimePickerLocale(
  language: SupportedLocale,
  timeFormat: (typeof TIME_FORMATS)[number] = 'TWELVE_HOUR',
): string {
  return timeFormat === 'TWELVE_HOUR'
    ? APP_LOCALES[language].pickerLocale
    : TWENTY_FOUR_HOUR_PICKER_LOCALE;
}

/** 표시 맥락(DateFormatContext)의 Intl 언어로 카탈로그 언어를 찾는다 */
export function toLanguageOfIntlLocale(intlLocale: IntlLocale): SupportedLocale {
  return (
    SUPPORTED_LOCALES.find((language) => APP_LOCALES[language].intlLocale === intlLocale) ??
    FALLBACK_LOCALE
  );
}
