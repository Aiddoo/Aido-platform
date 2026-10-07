import { Injectable } from "@nestjs/common";

import { CacheService } from "#api/platform/cache/cache.service";

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

@Injectable()
export class WeatherCacheAdapter implements WeatherCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getForecast(
    gridX: number,
    gridY: number,
    baseDate: string,
    baseTime: string,
  ): Promise<WeatherForecast | undefined> {
    return this.cacheService.get<WeatherForecast>(
      WeatherCacheKey.forecast(gridX, gridY, baseDate, baseTime),
    );
  }

  async saveForecast(
    gridX: number,
    gridY: number,
    baseDate: string,
    baseTime: string,
    forecast: WeatherForecast,
  ): Promise<void> {
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
    grids: WeatherGridRef[],
    baseDate: string,
    baseTime: string,
  ): Promise<(WeatherForecast | undefined)[]> {
    return this.cacheService.mget<WeatherForecast>(
      grids.map((g) => WeatherCacheKey.forecast(g.gridX, g.gridY, baseDate, baseTime)),
    );
  }

  async saveForecastBatch(
    entries: WeatherForecastEntry[],
    baseDate: string,
    baseTime: string,
  ): Promise<void> {
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

  getLatestForecastBatch(grids: WeatherGridRef[]): Promise<(WeatherForecast | undefined)[]> {
    return this.cacheService.mget<WeatherForecast>(
      grids.map((g) => WeatherCacheKey.latestForecast(g.gridX, g.gridY)),
    );
  }

  getConditions(gridX: number, gridY: number): Promise<WeatherConditions | undefined> {
    return this.cacheService.get<WeatherConditions>(WeatherCacheKey.conditions(gridX, gridY));
  }

  async setConditions(gridX: number, gridY: number, conditions: WeatherConditions): Promise<void> {
    await this.cacheService.set(
      WeatherCacheKey.conditions(gridX, gridY),
      conditions,
      WEATHER_CACHE_TTL_MS.CONDITIONS,
    );
  }

  async invalidateGrid(gridX: number, gridY: number): Promise<void> {
    await Promise.all([
      this.cacheService.delByPattern(WeatherCacheKey.forecastPattern(gridX, gridY)),
      this.cacheService.del(WeatherCacheKey.latestForecast(gridX, gridY)),
      this.cacheService.del(WeatherCacheKey.conditions(gridX, gridY)),
    ]);
  }
}
