import { chunk } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import { ForecastLogEvent } from "../forecasts.log-events.js";
import type {
  WeatherForecastCachePort,
  WeatherForecastEntry,
} from "../ports/weather-forecast-cache.port.js";
import type { WeatherForecastProviderPort } from "../ports/weather-forecast-provider.port.js";
import type {
  ReadWeatherForecastsQuery,
  WeatherForecastReaderPort,
} from "../ports/weather-forecast.reader.port.js";
import type { WeatherForecast } from "../read-models/weather-forecast.read-model.js";

/** 정기 sweep의 cache miss 전체를 동시에 보내면 공급자 실패 코드가 몰려 발생해 동시 호출 수를 제한한다. */
const MAX_CONCURRENT_FORECAST_REQUESTS = 4;

export interface ReadWeatherForecastsDependencies {
  readonly weatherProvider: Pick<
    WeatherForecastProviderPort,
    "resolveAvailability" | "getForecast"
  >;
  readonly weatherCache: Pick<
    WeatherForecastCachePort,
    "getForecastBatch" | "saveForecastBatch" | "getLatestForecastBatch"
  >;
  readonly logger: Pick<ApplicationLoggerPort, "warn" | "debug">;
  readonly clock: ClockPort;
}

function gridKey(grid: GridCoordinate): string {
  return `${grid.gridX}:${grid.gridY}`;
}

/**
 * 여러 격자의 예보를 한 번에 읽는다(캐시 묶음 읽기 → 미스만 공급자 → 묶음 저장). 실패한 격자는 latest로
 * 대신하고, 그것도 없으면 결과에서 뺀다. 공급자가 줄 수 없는 날짜면 빈 결과다.
 */
export class ReadWeatherForecastsUseCase implements WeatherForecastReaderPort {
  readonly #dependencies: ReadWeatherForecastsDependencies;

  constructor(dependencies: ReadWeatherForecastsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: ReadWeatherForecastsQuery): Promise<Map<string, WeatherForecast>> {
    const { weatherProvider, weatherCache, logger, clock } = this.#dependencies;
    const result = new Map<string, WeatherForecast>();
    if (query.grids.length === 0) {
      return result;
    }

    const availability = weatherProvider.resolveAvailability({
      target: query.target,
      now: clock.now(),
    });
    if (availability.kind === "UNAVAILABLE") {
      logger.warn({
        event: ForecastLogEvent.FORECAST_DATE_UNAVAILABLE,
        gridCount: query.grids.length,
      });
      return result;
    }
    const { timing } = availability;

    const grids = query.grids.map(({ gridX, gridY }) => GridCoordinate.reconstitute(gridX, gridY));
    const cached = await weatherCache.getForecastBatch(grids, timing);
    const misses: GridCoordinate[] = [];
    for (const [index, grid] of grids.entries()) {
      const hit = cached[index];
      if (hit == null) {
        misses.push(grid);
      } else {
        result.set(gridKey(grid), hit);
      }
    }
    if (misses.length === 0) {
      return result;
    }

    const settled: PromiseSettledResult<WeatherForecast>[] = [];
    for (const missChunk of chunk(misses, MAX_CONCURRENT_FORECAST_REQUESTS)) {
      settled.push(
        ...(await Promise.allSettled(
          missChunk.map((grid) => weatherProvider.getForecast(grid, timing)),
        )),
      );
    }

    const fetched: WeatherForecastEntry[] = [];
    const failed: GridCoordinate[] = [];
    for (const [index, outcome] of settled.entries()) {
      const grid = misses[index];
      if (grid == null) {
        continue;
      }
      if (outcome.status === "fulfilled") {
        fetched.push({ grid, forecast: outcome.value });
        result.set(gridKey(grid), outcome.value);
      } else {
        failed.push(grid);
      }
    }

    if (fetched.length > 0) {
      await weatherCache.saveForecastBatch(fetched, timing);
    }
    if (failed.length > 0) {
      await this.#fillFromLatest(failed, result);
    }

    logger.debug({
      event: ForecastLogEvent.FORECAST_BATCH_READ,
      gridCount: query.grids.length,
      cacheMissCount: misses.length,
    });
    return result;
  }

  async #fillFromLatest(
    failed: readonly GridCoordinate[],
    result: Map<string, WeatherForecast>,
  ): Promise<void> {
    const latest = await this.#dependencies.weatherCache.getLatestForecastBatch(failed);
    let fallbackCount = 0;
    for (const [index, grid] of failed.entries()) {
      const fallback = latest[index];
      if (fallback != null) {
        result.set(gridKey(grid), fallback);
        fallbackCount += 1;
      }
    }
    if (fallbackCount > 0) {
      this.#dependencies.logger.warn({
        event: ForecastLogEvent.FORECAST_FALLBACK_USED,
        fallbackCount,
      });
    }
  }
}
