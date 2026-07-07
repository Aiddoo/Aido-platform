import { getLocales } from 'expo-localization';

/** 기기 언어 코드('ko', 'en', ...)를 반환한다. 감지 실패 시 null. */
export function getDeviceLanguage(): string | null {
  return getLocales()[0]?.languageCode ?? null;
}
