import type { ResolvedRegion } from "../../../locations/application/ports/timezone-resolver.port.js";
import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type { WeatherReportLanguage } from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport } from "../../domain/weather-report.vo.js";

export interface WeatherReportReadRequest {
  /** 호출자가 결과를 다시 찾을 키(사용자 ID 등). 공급자에는 보내지 않는다. */
  readonly key: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly language: WeatherReportLanguage;
}

export interface LocatedWeatherReport {
  /** 칸 중심의 시간대. 일별 date가 이 시간대의 달력 날짜다. */
  readonly timezone: string;
  readonly report: WeatherReport;
}

/** 화면 조회와 다른 Context(날씨 알림)가 같은 칸 캐시·폴백으로 v2 리포트를 읽는다. */
export abstract class WeatherReportReaderPort {
  /**
   * 칸 캐시(동시 요청 한 번 load) → 공급자 → 마지막 성공 스냅샷 순으로 한 칸을 읽는다. 창은 자르지 않는다.
   * 스냅샷까지 없으면 `WEATHER_1901`이다.
   */
  abstract readReport(
    cell: GeoCell,
    region: ResolvedRegion,
    language: WeatherReportLanguage,
  ): Promise<WeatherReport>;

  /** 같은 칸·언어 요청은 한 번만 읽는다. 캐시·마지막 스냅샷까지 없는 칸의 키는 결과에서 빠진다. */
  abstract readReports(
    requests: readonly WeatherReportReadRequest[],
    now: Date,
  ): Promise<ReadonlyMap<string, LocatedWeatherReport>>;
}
