import type { SupportedLocale } from "#api/shared/domain/locale";

import type { WeatherBriefingForecast } from "../../../domain/services/reminders/weather-briefing.policy.js";

/** weather Context의 v2 리포트 조회(`WEATHER_REPORT_READER`)를 날씨 알림이 필요한 만큼만 본다. */
export const REMINDER_WEATHER_REPORT_READER = Symbol("REMINDER_WEATHER_REPORT_READER");

export interface ReminderWeatherReportRequest {
  /** 결과를 다시 찾을 키. 날씨 알림은 사용자 ID를 쓴다 */
  readonly key: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly language: SupportedLocale;
}

export interface ReminderWeatherReport {
  /** 위치 시간대 */
  readonly timezone: string;
  readonly report: WeatherBriefingForecast;
}

export interface ReminderWeatherReportReaderPort {
  /** 같은 칸 요청은 공급자를 한 번만 부른다. 캐시·마지막 스냅샷까지 없는 키는 결과에 없다. */
  readReports(
    requests: readonly ReminderWeatherReportRequest[],
    now: Date,
  ): Promise<ReadonlyMap<string, ReminderWeatherReport>>;
}
