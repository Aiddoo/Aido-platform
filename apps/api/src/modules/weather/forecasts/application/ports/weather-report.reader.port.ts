import type { WeatherReportLanguage } from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport } from "../../domain/weather-report.vo.js";

interface WeatherReportReadRequest {
  /** 호출자가 결과를 다시 찾을 키(사용자 ID 등). 공급자에는 보내지 않는다. */
  readonly key: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly language: WeatherReportLanguage;
}

export interface ReadWeatherReportsQuery {
  readonly requests: readonly WeatherReportReadRequest[];
  readonly now: Temporal.Instant;
}

export interface LocatedWeatherReport {
  /** 칸 중심의 시간대. 일별 date가 이 시간대의 달력 날짜다. */
  readonly timezone: string;
  readonly report: WeatherReport;
}

/** 다른 Context(날씨 알림)가 화면 조회와 같은 칸 캐시·폴백으로 v2 리포트를 묶어 읽는다. */
export abstract class WeatherReportReaderPort {
  /** 같은 칸·언어 요청은 한 번만 읽는다. 캐시·마지막 리포트까지 없는 칸의 키는 결과에서 빠진다. */
  abstract readReports(
    query: ReadWeatherReportsQuery,
  ): Promise<ReadonlyMap<string, LocatedWeatherReport>>;
}
