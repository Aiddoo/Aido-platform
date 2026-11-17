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

/** 번역 문구가 없는 지역의 리포트는 언어와 관계없이 한 캐시를 같이 쓴다. */
export const SHARED_WEATHER_REPORT_SCOPE = "shared";

export type WeatherReportCacheScope = WeatherReportLanguage | typeof SHARED_WEATHER_REPORT_SCOPE;
