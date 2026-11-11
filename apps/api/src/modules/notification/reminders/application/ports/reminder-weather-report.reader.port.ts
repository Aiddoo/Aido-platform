import type { WeatherBriefingForecast } from "#api/modules/weather/forecasts/weather-forecasts.public";
import type { SupportedLocale } from "#api/shared/domain/locale";

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

// weather Context의 v2 리포트 조회를 날씨 알림이 필요한 만큼만 본다
export abstract class ReminderWeatherReportReaderPort {
  /** 같은 칸 요청은 공급자를 한 번만 부른다. 캐시·마지막 스냅샷까지 없는 키는 결과에 없다. */
  abstract readReports(
    requests: readonly ReminderWeatherReportRequest[],
    now: Temporal.Instant,
  ): Promise<ReadonlyMap<string, ReminderWeatherReport>>;
}
