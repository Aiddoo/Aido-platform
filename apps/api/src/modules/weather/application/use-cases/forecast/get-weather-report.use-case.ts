import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { KoreanWeatherCoveragePolicy } from "../../../domain/policies/forecast/korean-weather-coverage.policy.js";
import { GeoCell } from "../../../domain/value-objects/forecast/geo-cell.vo.js";
import {
  SHARED_WEATHER_REPORT_SCOPE,
  type WeatherReportLanguage,
} from "../../models/forecast/weather-report-language.js";
import {
  type WeatherReport,
  windowWeatherReport,
} from "../../models/forecast/weather-report.model.js";
import { WeatherLogEvent } from "../../observability/forecast/weather-log.events.js";
import type {
  AirQuality,
  AirQualityProvider,
} from "../../ports/forecast/air-quality-provider.port.js";
import type {
  ResolvedRegion,
  TimezoneResolverPort,
} from "../../ports/forecast/timezone.resolver.port.js";
import type { WeatherLocationRepositoryPort } from "../../ports/forecast/weather-location.repository.port.js";
import type { WeatherReportCachePort } from "../../ports/forecast/weather-report.cache.port.js";
import type { WeatherReportProviderPort } from "../../ports/forecast/weather-report.provider.port.js";

const KOREA_COUNTRY_CODE = "KR";

export interface GetWeatherReportInput {
  readonly userId: string;
  readonly language: WeatherReportLanguage;
  readonly now: Date;
}

export interface WeatherReportResult {
  readonly location: {
    readonly latitude: number;
    readonly longitude: number;
    readonly timezone: string;
  };
  readonly report: WeatherReport;
  readonly airQuality: AirQuality | null;
}

interface GetWeatherReportDependencies {
  readonly weatherLocationRepository: Pick<WeatherLocationRepositoryPort, "findByUserId">;
  readonly weatherReportProvider: Pick<WeatherReportProviderPort, "getReport" | "localizesContent">;
  readonly weatherReportCache: Pick<
    WeatherReportCachePort,
    "getOrLoadReport" | "getLatestReport" | "getOrLoadAirQuality"
  >;
  readonly timezoneResolver: Pick<TimezoneResolverPort, "resolve">;
  readonly airQualityProvider: Pick<AirQualityProvider, "getAirQuality">;
  readonly logger: Pick<ApplicationLogger, "warn" | "error">;
}

export class GetWeatherReport {
  readonly #dependencies: GetWeatherReportDependencies;

  constructor(dependencies: GetWeatherReportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetWeatherReportInput): Promise<WeatherReportResult> {
    const location = await this.#dependencies.weatherLocationRepository.findByUserId(input.userId);
    if (location == null) {
      throw new ApplicationException(ErrorCode.WEATHER_1902);
    }

    const cell = GeoCell.fromCoordinate(location.coordinate);
    // 같은 칸의 캐시를 모두가 공유하므로 공급자 요청 조건도 사용자 좌표가 아닌 칸 중심에서 정한다.
    const region = this.#dependencies.timezoneResolver.resolve(cell.center);
    const isKorea =
      region.countryCode === KOREA_COUNTRY_CODE &&
      KoreanWeatherCoveragePolicy.covers(location.coordinate);

    const [reportResult, airQualityResult] = await Promise.allSettled([
      this.#loadReport(cell, region, input.language),
      isKorea ? this.#loadAirQuality(cell) : Promise.resolve(null),
    ]);
    if (reportResult.status === "rejected") {
      throw reportResult.reason;
    }
    if (airQualityResult.status === "rejected") {
      this.#dependencies.logger.warn({
        event: WeatherLogEvent.REPORT_AIR_QUALITY_UNAVAILABLE,
        cellKey: cell.key,
        errorType: errorTypeOf(airQualityResult.reason),
      });
    }

    return {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone ?? region.timezone,
      },
      report: windowWeatherReport(reportResult.value, input.now, region.timezone),
      airQuality: airQualityResult.status === "fulfilled" ? airQualityResult.value : null,
    };
  }

  async #loadReport(
    cell: GeoCell,
    region: ResolvedRegion,
    language: WeatherReportLanguage,
  ): Promise<WeatherReport> {
    const request = { timezone: region.timezone, countryCode: region.countryCode, language };
    const scope = (await this.#dependencies.weatherReportProvider.localizesContent(cell, request))
      ? language
      : SHARED_WEATHER_REPORT_SCOPE;
    try {
      return await this.#dependencies.weatherReportCache.getOrLoadReport(cell, scope, () =>
        this.#dependencies.weatherReportProvider.getReport(cell, request),
      );
    } catch (error) {
      // 공급자 실패의 상세(status·latency)는 adapter가 이미 기록했다. 여기서는 폴백 결과만 남긴다.
      const latest = await this.#dependencies.weatherReportCache.getLatestReport(cell, scope);
      if (latest == null) {
        this.#dependencies.logger.error({
          event: WeatherLogEvent.REPORT_UNAVAILABLE,
          cellKey: cell.key,
          fallback: false,
          errorType: errorTypeOf(error),
          errorCode: ErrorCode.WEATHER_1901,
        });
        throw new ApplicationException(ErrorCode.WEATHER_1901);
      }
      this.#dependencies.logger.warn({
        event: WeatherLogEvent.REPORT_FALLBACK_USED,
        cellKey: cell.key,
        fallback: true,
        fetchedAt: latest.fetchedAt.toISOString(),
      });
      return latest;
    }
  }

  #loadAirQuality(cell: GeoCell): Promise<AirQuality | null> {
    const { latitude, longitude } = cell.center;
    return this.#dependencies.weatherReportCache.getOrLoadAirQuality(cell, () =>
      this.#dependencies.airQualityProvider.getAirQuality(latitude, longitude),
    );
  }
}

function errorTypeOf(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
