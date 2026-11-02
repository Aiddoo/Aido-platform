import type { GeoCell } from "../../../domain/value-objects/forecast/geo-cell.vo.js";
import type { WeatherReportCacheScope } from "../../models/forecast/weather-report-language.js";
import type { WeatherReport } from "../../models/forecast/weather-report.model.js";
import type { AirQuality } from "./air-quality-provider.port.js";

export const WEATHER_REPORT_CACHE = Symbol("WEATHER_REPORT_CACHE");

export interface WeatherReportCachePort {
  /**
   * 신선한 스냅샷을 읽고, 없으면 같은 칸의 동시 요청을 한 번의 load로 묶어 저장한다.
   * 보관 시간은 스냅샷 내용으로 정한다(`weatherReportTtlMs`).
   */
  getOrLoadReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
    load: () => Promise<WeatherReport>,
  ): Promise<WeatherReport>;

  /** 공급자 장애 때 보여 줄 마지막 성공 스냅샷. */
  getLatestReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
  ): Promise<WeatherReport | undefined>;

  /** 대기질은 null(측정 없음)을 저장하지 않아 다음 요청이 다시 조회한다. */
  getOrLoadAirQuality(
    cell: GeoCell,
    load: () => Promise<AirQuality | null>,
  ): Promise<AirQuality | null>;
}
