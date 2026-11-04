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
  KMA_TIMEZONE,
  type KmaForecastTiming,
} from "../../../domain/policies/forecast/kma-forecast-availability.policy.js";
import {
  WEATHER_CACHE_TTL_MS,
  WeatherCacheKey,
} from "../../cache/forecast/weather-cache.keyspace.js";
import { getKmaBaseDateTime } from "./kma-base-datetime.js";

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

function forecastKey(gridX: number, gridY: number, timing: KmaForecastTiming): string {
  const { baseDate, baseTime } = getKmaBaseDateTime(timing.issuance);
  const targetDate = dayWindowInTimezone(timing.target, KMA_TIMEZONE).localDate;
  return WeatherCacheKey.forecast(gridX, gridY, baseDate, baseTime, targetDate);
}

@Injectable()
export class WeatherCacheAdapter implements WeatherCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getForecast(
    gridX: number,
    gridY: number,
    timing: KmaForecastTiming,
  ): Promise<WeatherForecast | undefined> {
    return this.cacheService.get(forecastKey(gridX, gridY, timing), WEATHER_FORECAST_SCHEMA);
  }

  async saveForecast(
    gridX: number,
    gridY: number,
    timing: KmaForecastTiming,
    forecast: WeatherForecast,
  ): Promise<void> {
    await Promise.all([
      this.cacheService.set(
        forecastKey(gridX, gridY, timing),
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

  getOrLoadForecast(
    gridX: number,
    gridY: number,
    timing: KmaForecastTiming,
    load: () => Promise<WeatherForecast>,
  ): Promise<WeatherForecast> {
    return this.cacheService.wrap(
      forecastKey(gridX, gridY, timing),
      WEATHER_FORECAST_SCHEMA,
      async () => {
        const forecast = await load();
        await this.cacheService.set(
          WeatherCacheKey.latestForecast(gridX, gridY),
          forecast,
          WEATHER_CACHE_TTL_MS.LATEST_FORECAST,
        );
        return forecast;
      },
      WEATHER_CACHE_TTL_MS.FORECAST,
    );
  }

  hasRecentForecastFailure(gridX: number, gridY: number): Promise<boolean> {
    return this.cacheService.has(WeatherCacheKey.forecastFailure(gridX, gridY));
  }

  markForecastFailure(gridX: number, gridY: number): Promise<void> {
    return this.cacheService.set(
      WeatherCacheKey.forecastFailure(gridX, gridY),
      true,
      WEATHER_CACHE_TTL_MS.FORECAST_FAILURE,
    );
  }

  getLatestForecast(gridX: number, gridY: number): Promise<WeatherForecast | undefined> {
    return this.cacheService.get(
      WeatherCacheKey.latestForecast(gridX, gridY),
      WEATHER_FORECAST_SCHEMA,
    );
  }

  getForecastBatch(
    grids: readonly WeatherGridRef[],
    timing: KmaForecastTiming,
  ): Promise<(WeatherForecast | undefined)[]> {
    return this.cacheService.mget(
      grids.map((grid) => forecastKey(grid.gridX, grid.gridY, timing)),
      WEATHER_FORECAST_SCHEMA,
    );
  }

  async saveForecastBatch(
    entries: readonly WeatherForecastEntry[],
    timing: KmaForecastTiming,
  ): Promise<void> {
    const cacheEntries = entries.flatMap((entry) => [
      {
        key: forecastKey(entry.gridX, entry.gridY, timing),
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
    ]);
  }
}
