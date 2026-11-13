import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import type { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import { forecastDateUnsupported, weatherServiceUnavailable } from "../forecasts.errors.js";
import { ForecastLogEvent } from "../forecasts.log-events.js";
import type { WeatherForecastCachePort } from "../ports/weather-forecast-cache.port.js";
import type { WeatherForecastProviderPort } from "../ports/weather-forecast-provider.port.js";
import type { WeatherForecast } from "../read-models/weather-forecast.read-model.js";

export interface ReadWeatherForecastQuery {
  readonly grid: GridCoordinate;
  readonly target: Temporal.Instant;
}

export interface ReadWeatherForecastDependencies {
  readonly weatherProvider: Pick<
    WeatherForecastProviderPort,
    "resolveAvailability" | "getForecast" | "name"
  >;
  readonly weatherCache: Pick<
    WeatherForecastCachePort,
    | "getForecast"
    | "getOrLoadForecast"
    | "hasRecentForecastFailure"
    | "markForecastFailure"
    | "getLatestForecast"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
  readonly clock: ClockPort;
}

/**
 * 한 격자의 예보를 읽는다(캐시 → 격자 최근 실패 확인 → 공급자(동시 요청 합치기) → latest 폴백 → WEATHER_1901).
 * 공급자가 줄 수 없는 날짜는 공급자를 부르지 않고 400 SYS_0002로 거절한다.
 */
export class ReadWeatherForecastUseCase {
  readonly #dependencies: ReadWeatherForecastDependencies;

  constructor(dependencies: ReadWeatherForecastDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ReadWeatherForecastQuery): Promise<WeatherForecast> {
    const { weatherCache, weatherProvider, logger, clock } = this.#dependencies;
    const { grid } = query;
    const availability = weatherProvider.resolveAvailability({
      target: query.target,
      now: clock.now(),
    });
    if (availability.kind === "UNAVAILABLE") {
      throw forecastDateUnsupported();
    }
    const { timing } = availability;

    const cached = await weatherCache.getForecast(grid, timing);
    if (cached != null) {
      return cached;
    }

    // 같은 격자가 1분 안에 실패했으면 요청마다 공급자 시간 초과를 기다리지 않고 latest로 넘어간다.
    if (!(await weatherCache.hasRecentForecastFailure(grid))) {
      try {
        return await weatherCache.getOrLoadForecast(grid, timing, () =>
          weatherProvider.getForecast(grid, timing),
        );
      } catch (error) {
        logger.warn({
          event: ForecastLogEvent.FORECAST_PROVIDER_FAILED,
          provider: weatherProvider.name,
          errorType: toErrorType(error),
        });
        await weatherCache.markForecastFailure(grid);
      }
    }

    const latest = await weatherCache.getLatestForecast(grid);
    if (latest != null) {
      logger.warn({ event: ForecastLogEvent.FORECAST_FALLBACK_USED });
      return latest;
    }

    throw weatherServiceUnavailable();
  }
}
