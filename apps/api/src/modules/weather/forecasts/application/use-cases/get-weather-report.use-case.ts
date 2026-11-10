import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import type { TimezoneResolverPort } from "../../../locations/application/ports/timezone-resolver.port.js";
import type { UserLocationRepositoryPort } from "../../../locations/application/ports/user-location.repository.port.js";
import { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { isKoreanWeatherCovered } from "../../../shared/domain/korean-weather-coverage.domain-service.js";
import type { WeatherReportLanguage } from "../../domain/weather-report-language.domain-service.js";
import { windowWeatherReport } from "../../domain/weather-report-window.domain-service.js";
import {
  type WeatherReport,
  type WeatherReportAttribution,
} from "../../domain/weather-report.vo.js";
import { ForecastLogEvent } from "../forecasts.log-events.js";
import type { AirQuality, AirQualityProviderPort } from "../ports/air-quality-provider.port.js";
import type { WeatherReportCachePort } from "../ports/weather-report-cache.port.js";
import type { WeatherReportProviderPort } from "../ports/weather-report-provider.port.js";
import type { WeatherReportReaderPort } from "../ports/weather-report.reader.port.js";

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
  readonly attribution: WeatherReportAttribution;
}

interface GetWeatherReportDependencies {
  readonly weatherLocationRepository: Pick<UserLocationRepositoryPort, "findByUserId">;
  readonly weatherReportReader: Pick<WeatherReportReaderPort, "readReport">;
  readonly weatherReportProvider: Pick<WeatherReportProviderPort, "getAttribution">;
  readonly weatherReportCache: Pick<WeatherReportCachePort, "getOrLoadAirQuality">;
  readonly timezoneResolver: Pick<TimezoneResolverPort, "resolve">;
  readonly airQualityProvider: Pick<AirQualityProviderPort, "getAirQuality">;
  readonly logger: Pick<ApplicationLoggerPort, "warn" | "error">;
}

export class GetWeatherReportUseCase {
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
    // 리포트·대기질 캐시를 칸 단위로 공유하므로 시간대·국가·대기질 여부도 사용자 좌표가 아닌 칸 중심에서 정한다.
    const region = this.#dependencies.timezoneResolver.resolve(cell.center);
    const isKorea =
      region.countryCode === KOREA_COUNTRY_CODE && isKoreanWeatherCovered(cell.center);

    // 리포트는 언어 공유 캐시일 수 있으므로 공급자 표기는 요청 언어로 따로 받는다.
    const [reportResult, airQualityResult, attributionResult] = await Promise.allSettled([
      this.#dependencies.weatherReportReader.readReport(cell, region, input.language),
      isKorea ? this.#loadAirQuality(cell) : Promise.resolve(null),
      this.#dependencies.weatherReportProvider.getAttribution(input.language),
    ]);
    if (reportResult.status === "rejected") {
      throw reportResult.reason;
    }
    if (attributionResult.status === "rejected") {
      throw attributionResult.reason;
    }
    if (airQualityResult.status === "rejected") {
      this.#dependencies.logger.warn({
        event: ForecastLogEvent.REPORT_AIR_QUALITY_UNAVAILABLE,
        cellKey: cell.key,
        errorType: toErrorType(airQualityResult.reason),
      });
    }

    return {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: region.timezone,
      },
      report: windowWeatherReport(reportResult.value, input.now, region.timezone),
      airQuality: airQualityResult.status === "fulfilled" ? airQualityResult.value : null,
      attribution: attributionResult.value,
    };
  }

  #loadAirQuality(cell: GeoCell): Promise<AirQuality | null> {
    const { latitude, longitude } = cell.center;
    return this.#dependencies.weatherReportCache.getOrLoadAirQuality(cell, () =>
      this.#dependencies.airQualityProvider.getAirQuality(latitude, longitude),
    );
  }
}
