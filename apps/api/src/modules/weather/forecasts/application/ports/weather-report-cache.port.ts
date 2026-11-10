import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type { WeatherReportCacheScope } from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport } from "../../domain/weather-report.vo.js";
import type { AirQuality } from "./air-quality-provider.port.js";

export abstract class WeatherReportCachePort {
  /**
   * 신선한 스냅샷을 읽고, 없으면 같은 칸의 동시 요청을 한 번의 load로 묶어 저장한다.
   * 보관 시간은 스냅샷 내용으로 정한다(`weatherReportTtlMs`).
   */
  abstract getOrLoadReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
    load: () => Promise<WeatherReport>,
  ): Promise<WeatherReport>;

  /** 공급자 장애 때 보여 줄 마지막 성공 스냅샷. */
  abstract getLatestReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
  ): Promise<WeatherReport | undefined>;

  /** 대기질은 null(측정 없음)을 저장하지 않아 다음 요청이 다시 조회한다. */
  abstract getOrLoadAirQuality(
    cell: GeoCell,
    load: () => Promise<AirQuality | null>,
  ): Promise<AirQuality | null>;
}
