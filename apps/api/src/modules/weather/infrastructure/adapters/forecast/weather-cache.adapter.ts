import { Injectable } from "@nestjs/common";
import { z } from "zod";

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

const SKY_CONDITION_SCHEMA = z.enum(["CLEAR", "PARTLY_CLOUDY", "CLOUDY"]);
const PRECIPITATION_TYPE_SCHEMA = z.enum(["NONE", "RAIN", "RAIN_SNOW", "SNOW", "SHOWER"]);

/** Redis JSON에서 문자열이 된 예보 기준 시각을 Date로 복원한다. */
const WEATHER_FORECAST_SCHEMA = z.object({
  date: z.coerce.date(),
  skyCondition: SKY_CONDITION_SCHEMA,
  precipitationType: PRECIPITATION_TYPE_SCHEMA,
  precipitationProbability: z.number(),
  temperatureMin: z.number(),
  temperatureMax: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  hourlyForecasts: z.array(
    z.object({
      hour: z.number(),
      temperature: z.number(),
      skyCondition: z.string(),
      precipitationProbability: z.number(),
      precipitationAmount: z.number(),
      snowAmount: z.number(),
    }),
  ),
  dailyForecasts: z.array(
    z.object({
      date: z.string(),
      skyCondition: SKY_CONDITION_SCHEMA,
      precipitationType: PRECIPITATION_TYPE_SCHEMA,
      precipitationProbability: z.number(),
      temperatureMin: z.number(),
      temperatureMax: z.number(),
    }),
  ),
}) satisfies z.ZodType<WeatherForecast>;

const WEATHER_CONDITIONS_SCHEMA = z.object({
  feelsLikeTemperature: z.number().nullable(),
  uvIndex: z.number().nullable(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
  pm10: z.number().nullable(),
  pm25: z.number().nullable(),
}) satisfies z.ZodType<WeatherConditions>;

@Injectable()
export class WeatherCacheAdapter implements WeatherCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getForecast(gridX: number, gridY: number, date: Date): Promise<WeatherForecast | undefined> {
    const { baseDate, baseTime } = getKmaBaseDateTime(date);
    return this.cacheService.get(
      WeatherCacheKey.forecast(gridX, gridY, baseDate, baseTime),
      WEATHER_FORECAST_SCHEMA,
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
    return this.cacheService.get(
      WeatherCacheKey.latestForecast(gridX, gridY),
      WEATHER_FORECAST_SCHEMA,
    );
  }

  getForecastBatch(
    grids: readonly WeatherGridRef[],
    date: Date,
  ): Promise<(WeatherForecast | undefined)[]> {
    const { baseDate, baseTime } = getKmaBaseDateTime(date);
    return this.cacheService.mget(
      grids.map((grid) => WeatherCacheKey.forecast(grid.gridX, grid.gridY, baseDate, baseTime)),
      WEATHER_FORECAST_SCHEMA,
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
    return this.cacheService.mget(
      grids.map((grid) => WeatherCacheKey.latestForecast(grid.gridX, grid.gridY)),
      WEATHER_FORECAST_SCHEMA,
    );
  }

  getConditions(gridX: number, gridY: number, date: Date): Promise<WeatherConditions | undefined> {
    const { localDate } = dayWindowInTimezone(date, KMA_TIMEZONE);
    return this.cacheService.get(
      WeatherCacheKey.conditions(gridX, gridY, localDate),
      WEATHER_CONDITIONS_SCHEMA,
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
