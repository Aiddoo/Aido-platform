import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type { WeatherReportCacheScope } from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport } from "../../domain/weather-report.aggregate.js";
import type { CellWeatherReportReadModel } from "../read-models/cell-weather-report.read-model.js";
import type { AirQuality } from "./air-quality-provider.port.js";

export abstract class WeatherReportCachePort {
  /**
   * 신선한 리포트를 읽고, 없으면 같은 칸의 동시 요청을 한 번의 load로 묶어 저장한다.
   * 보관 시간은 공급자 호출 예산, 곧 강수(분 단위 예보가 있을 때), 공급자 예보 만료 순으로 정한다.
   */
  abstract getOrLoadReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
    load: () => Promise<WeatherReport>,
  ): Promise<CellWeatherReportReadModel>;

  /** 공급자 장애 때 보여 줄 마지막 성공 리포트. */
  abstract findLatestReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
  ): Promise<WeatherReport | null>;

  /** 측정값은 1시간, 측정 없음(null)은 30분 저장한다. load 실패는 저장하지 않아 다음 요청이 다시 조회한다. */
  abstract findOrLoadAirQuality(
    cell: GeoCell,
    load: () => Promise<AirQuality | null>,
  ): Promise<AirQuality | null>;
}
