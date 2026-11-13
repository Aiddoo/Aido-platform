import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { ResolvedRegion } from "../../../locations/application/ports/timezone-resolver.port.js";
import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import {
  SHARED_WEATHER_REPORT_SCOPE,
  type WeatherReportCacheScope,
  type WeatherReportLanguage,
} from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport } from "../../domain/weather-report.vo.js";
import { weatherServiceUnavailable } from "../forecasts.errors.js";
import { ForecastLogEvent } from "../forecasts.log-events.js";
import type { WeatherReportCachePort } from "../ports/weather-report-cache.port.js";
import type {
  WeatherReportProviderPort,
  WeatherReportRequest,
} from "../ports/weather-report-provider.port.js";

export interface ReadWeatherReportQuery {
  readonly cell: GeoCell;
  readonly region: ResolvedRegion;
  readonly language: WeatherReportLanguage;
}

export interface ReadWeatherReportDependencies {
  readonly weatherReportProvider: Pick<WeatherReportProviderPort, "getReport" | "localizesContent">;
  readonly weatherReportCache: Pick<WeatherReportCachePort, "getOrLoadReport" | "getLatestReport">;
  readonly logger: Pick<ApplicationLoggerPort, "warn" | "error">;
}

/**
 * 한 칸의 v2 리포트를 칸 캐시(동시 요청 한 번 load) → 공급자 → 마지막 성공 스냅샷 순으로 읽는다.
 * 창은 자르지 않는다. 스냅샷까지 없으면 `WEATHER_1901`이다.
 */
export class ReadWeatherReportUseCase {
  readonly #dependencies: ReadWeatherReportDependencies;

  constructor(dependencies: ReadWeatherReportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ReadWeatherReportQuery): Promise<WeatherReport> {
    const { cell, region, language } = query;
    const request = { timezone: region.timezone, countryCode: region.countryCode, language };
    const scope = await this.#cacheScope(cell, request);
    try {
      return await this.#dependencies.weatherReportCache.getOrLoadReport(cell, scope, () =>
        this.#dependencies.weatherReportProvider.getReport(cell, request),
      );
    } catch (error) {
      // 공급자 실패의 상세(status·latency)는 adapter가 이미 기록했다. 여기서는 폴백 결과만 남긴다.
      const latest = await this.#latestReport(cell, scope, language);
      if (latest == null) {
        this.#dependencies.logger.error({
          event: ForecastLogEvent.REPORT_UNAVAILABLE,
          cellKey: cell.key,
          fallback: false,
          errorType: toErrorType(error),
          errorCode: ErrorCode.WEATHER_1901,
        });
        throw weatherServiceUnavailable(undefined, error);
      }
      this.#dependencies.logger.warn({
        event: ForecastLogEvent.REPORT_FALLBACK_USED,
        cellKey: cell.key,
        fallback: true,
        fetchedAt: toIsoString(latest.fetchedAt),
      });
      return latest;
    }
  }

  /**
   * 장애 중 가용성 캐시가 없으면 scope가 공유로 바뀌므로, 그 scope의 스냅샷이 없을 때 다른 scope의 스냅샷도 본다.
   * 공유 스냅샷은 특보 제목이 없을 뿐 같은 칸의 예보다.
   */
  async #latestReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
    language: WeatherReportLanguage,
  ): Promise<WeatherReport | undefined> {
    const { weatherReportCache } = this.#dependencies;
    const otherScope =
      scope === SHARED_WEATHER_REPORT_SCOPE ? language : SHARED_WEATHER_REPORT_SCOPE;
    return (
      (await weatherReportCache.getLatestReport(cell, scope)) ??
      weatherReportCache.getLatestReport(cell, otherScope)
    );
  }

  /**
   * 번역 문구가 없는 칸은 언어별로 캐시를 나누지 않는다. 판단이 실패하면(자격 증명 미설정 등) 공유 scope로 두고
   * 같은 원인으로 실패할 본 호출이 폴백·`WEATHER_1901` 경로를 거치게 한다.
   */
  async #cacheScope(
    cell: GeoCell,
    request: WeatherReportRequest,
  ): Promise<WeatherReportCacheScope> {
    try {
      return (await this.#dependencies.weatherReportProvider.localizesContent(cell, request))
        ? request.language
        : SHARED_WEATHER_REPORT_SCOPE;
    } catch (error) {
      this.#dependencies.logger.warn({
        event: ForecastLogEvent.REPORT_CACHE_SCOPE_FAILED,
        cellKey: cell.key,
        errorType: toErrorType(error),
      });
      return SHARED_WEATHER_REPORT_SCOPE;
    }
  }
}
