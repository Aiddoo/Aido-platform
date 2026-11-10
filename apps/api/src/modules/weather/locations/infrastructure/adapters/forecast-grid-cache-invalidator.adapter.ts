import { Injectable } from "@nestjs/common";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";

import { WeatherCacheKey } from "../../../forecasts/infrastructure/cache/weather-forecast.keyspace.js";
import type { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import type { ForecastGridCacheInvalidatorPort } from "../../application/ports/forecast-grid-cache-invalidator.port.js";

/** v1 KMA 격자 캐시(정규 예보 패턴·latest·부가 정보)를 한 격자 단위로 비운다. */
@Injectable()
export class ForecastGridCacheInvalidatorAdapter implements ForecastGridCacheInvalidatorPort {
  readonly #cache: CacheStorePort;

  constructor(cache: CacheStorePort) {
    this.#cache = cache;
  }

  async invalidateGrid(grid: GridCoordinate): Promise<void> {
    const { gridX, gridY } = grid;
    await Promise.all([
      this.#cache.delByPattern(WeatherCacheKey.forecastPattern(gridX, gridY)),
      this.#cache.del(WeatherCacheKey.latestForecast(gridX, gridY)),
      this.#cache.delByPattern(WeatherCacheKey.conditionsPattern(gridX, gridY)),
    ]);
  }
}
