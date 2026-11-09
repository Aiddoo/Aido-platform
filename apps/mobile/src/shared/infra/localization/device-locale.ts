import { getLocales, useCalendars, useLocales } from 'expo-localization';

export interface SystemLocale {
  languageCode: string | null;
  regionCode: string | null;
  temperatureUnit: 'celsius' | 'fahrenheit' | null;
}

export interface SystemCalendar {
  timeZone: string | null;
}

/** 기기 언어 코드('ko', 'en', ...)를 반환한다. 감지 실패 시 null. */
export function getDeviceLanguage(): string | null {
  return getLocales()[0]?.languageCode ?? null;
}

export function useSystemLocale(): SystemLocale {
  const [locale] = useLocales();
  return locale;
}

export function useSystemCalendar(): SystemCalendar {
  const [calendar] = useCalendars();
  return calendar;
}
