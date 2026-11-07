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

/** 지역 설정이 실행 중에 바뀌면 다시 렌더하고 새 객체를 돌려준다 */
export function useSystemLocale(): SystemLocale {
  const [locale] = useLocales();
  return locale;
}

/** 시간대·달력 설정이 실행 중에 바뀌면 다시 렌더하고 새 객체를 돌려준다 */
export function useSystemCalendar(): SystemCalendar {
  const [calendar] = useCalendars();
  return calendar;
}
