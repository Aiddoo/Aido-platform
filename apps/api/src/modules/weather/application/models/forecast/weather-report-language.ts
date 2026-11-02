import type { SupportedLocale } from "#api/shared/domain/locale";

export type WeatherReportLanguage = SupportedLocale;

/**
 * 공급자가 번역하는 문구(특보 제목)의 언어다. 캐시가 언어별로 나뉘므로 앱 지원 언어로만 받고,
 * Accept-Language를 보내지 않은 요청은 한국어 기본값 대신 영어로 받는다.
 */
export function resolveWeatherReportLanguage(
  locale: SupportedLocale | undefined,
): WeatherReportLanguage {
  return locale ?? "en";
}
