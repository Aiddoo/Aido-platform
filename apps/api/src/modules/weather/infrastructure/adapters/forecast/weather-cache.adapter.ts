import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/platform/cache/cache.service";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type {
  WeatherCachePort,
  WeatherForecastEntry,
  WeatherGridRef,
} from "../../../application/ports/forecast/weather-cache.port.js";
import type {
  WeatherConditions,
  WeatherForecast,
} from "../../../application/ports/forecast/weather-provider.port.js";
import {
  WEATHER_CACHE_TTL_MS,
  WeatherCacheKey,
} from "../../cache/forecast/weather-cache.keyspace.js";
import { getKmaBaseDateTime } from "./kma-base-datetime.js";
import { KMA_TIMEZONE } from "./kma.constants.js";

@Injectable()
export class WeatherCacheAdapter implements WeatherCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getForecast(gridX: number, gridY: number, date: Date): Promise<WeatherForecast | undefined> {
    const { baseDate, baseTime } = getKmaBaseDateTime(date);
    return this.cacheService.get<WeatherForecast>(
      WeatherCacheKey.forecast(gridX, gridY, baseDate, baseTime),
    );
  }

  async saveForecast(
    gridX: number,
    gridY: number,
    date: Date,
    forecast: WeatherForecast,
  ): Promise<void> {
    const { baseDate, baseTime } = getKmaBaseDateTime(date);
    await Promise.all([
      this.cacheService.set(
        WeatherCacheKey.forecast(gridX, gridY, baseDate, baseTime),
        forecast,
        WEATHER_CACHE_TTL_MS.FORECAST,
      ),
      this.cacheService.set(
        WeatherCacheKey.latestForecast(gridX, gridY),
        forecast,
        WEATHER_CACHE_TTL_MS.LATEST_FORECAST,
      ),
    ]);
  }

  getLatestForecast(gridX: number, gridY: number): Promise<WeatherForecast | undefined> {
    return this.cacheService.get<WeatherForecast>(WeatherCacheKey.latestForecast(gridX, gridY));
  }

  getForecastBatch(
    grids: readonly WeatherGridRef[],
    date: Date,
  ): Promise<(WeatherForecast | undefined)[]> {
    const { baseDate, baseTime } = getKmaBaseDateTime(date);
    return this.cacheService.mget<WeatherForecast>(
      grids.map((grid) => WeatherCacheKey.forecast(grid.gridX, grid.gridY, baseDate, baseTime)),
    );
  }

  async saveForecastBatch(entries: readonly WeatherForecastEntry[], date: Date): Promise<void> {
    const { baseDate, baseTime } = getKmaBaseDateTime(date);
    const cacheEntries = entries.flatMap((entry) => [
      {
        key: WeatherCacheKey.forecast(entry.gridX, entry.gridY, baseDate, baseTime),
        value: entry.forecast,
        ttl: WEATHER_CACHE_TTL_MS.FORECAST,
      },
      {
        key: WeatherCacheKey.latestForecast(entry.gridX, entry.gridY),
        value: entry.forecast,
        ttl: WEATHER_CACHE_TTL_MS.LATEST_FORECAST,
      },
    ]);
    await this.cacheService.mset(cacheEntries);
  }

  getLatestForecastBatch(
    grids: readonly WeatherGridRef[],
  ): Promise<(WeatherForecast | undefined)[]> {
    return this.cacheService.mget<WeatherForecast>(
      grids.map((grid) => WeatherCacheKey.latestForecast(grid.gridX, grid.gridY)),
    );
  }

  getConditions(gridX: number, gridY: number, date: Date): Promise<WeatherConditions | undefined> {
    const { localDate } = dayWindowInTimezone(date, KMA_TIMEZONE);
    return this.cacheService.get<WeatherConditions>(
      WeatherCacheKey.conditions(gridX, gridY, localDate),
    );
  }

  async setConditions(
    gridX: number,
    gridY: number,
    date: Date,
    conditions: WeatherConditions,
  ): Promise<void> {
    const { localDate } = dayWindowInTimezone(date, KMA_TIMEZONE);
    await this.cacheService.set(
      WeatherCacheKey.conditions(gridX, gridY, localDate),
      conditions,
      WEATHER_CACHE_TTL_MS.CONDITIONS,
    );
  }

  async invalidateGrid(gridX: number, gridY: number): Promise<void> {
    await Promise.all([
      this.cacheService.delByPattern(WeatherCacheKey.forecastPattern(gridX, gridY)),
      this.cacheService.del(WeatherCacheKey.latestForecast(gridX, gridY)),
      this.cacheService.delByPattern(WeatherCacheKey.conditionsPattern(gridX, gridY)),
      this.cacheService.del(WeatherCacheKey.legacyConditions(gridX, gridY)),
    ]);
  }
}
