import { PRECIPITATION_TYPES, SKY_CONDITIONS } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";

import { localDateAt } from "../../../shared/domain/weather-calendar.domain-service.js";
import type {
  WeatherForecastCachePort,
  WeatherForecastEntry,
  WeatherGridRef,
} from "../../application/ports/weather-forecast-cache.port.js";
import type {
  WeatherConditions,
  WeatherForecast,
} from "../../application/read-models/weather-forecast.read-model.js";
import { getKmaBaseDateTime } from "../../domain/kma-base-datetime.domain-service.js";
import {
  KMA_TIMEZONE,
  type KmaForecastTiming,
} from "../../domain/kma-forecast-availability.domain-service.js";
import { WEATHER_CACHE_TTL_MS, WeatherCacheKey } from "./weather-forecast.keyspace.js";

const SKY_CONDITION_SCHEMA = z.enum(SKY_CONDITIONS);
const PRECIPITATION_TYPE_SCHEMA = z.enum(PRECIPITATION_TYPES);

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
  const targetDate = localDateAt(timing.target, KMA_TIMEZONE).toString();
  return WeatherCacheKey.forecast(gridX, gridY, baseDate, baseTime, targetDate);
}

@Injectable()
export class WeatherForecastCache implements WeatherForecastCachePort {
  readonly #cache: CacheStorePort;

  constructor(cache: CacheStorePort) {
    this.#cache = cache;
  }

  getForecast(
    gridX: number,
    gridY: number,
    timing: KmaForecastTiming,
  ): Promise<WeatherForecast | undefined> {
    return this.#cache.get(forecastKey(gridX, gridY, timing), WEATHER_FORECAST_SCHEMA);
  }

  getOrLoadForecast(
    gridX: number,
    gridY: number,
    timing: KmaForecastTiming,
    load: () => Promise<WeatherForecast>,
  ): Promise<WeatherForecast> {
    return this.#cache.wrap(
      forecastKey(gridX, gridY, timing),
      WEATHER_FORECAST_SCHEMA,
      async () => {
        const forecast = await load();
        await this.#cache.set(
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
    return this.#cache.has(WeatherCacheKey.forecastFailure(gridX, gridY));
  }

  markForecastFailure(gridX: number, gridY: number): Promise<void> {
    return this.#cache.set(
      WeatherCacheKey.forecastFailure(gridX, gridY),
      true,
      WEATHER_CACHE_TTL_MS.FORECAST_FAILURE,
    );
  }

  getLatestForecast(gridX: number, gridY: number): Promise<WeatherForecast | undefined> {
    return this.#cache.get(WeatherCacheKey.latestForecast(gridX, gridY), WEATHER_FORECAST_SCHEMA);
  }

  getForecastBatch(
    grids: readonly WeatherGridRef[],
    timing: KmaForecastTiming,
  ): Promise<(WeatherForecast | undefined)[]> {
    return this.#cache.mget(
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
        ttlMs: WEATHER_CACHE_TTL_MS.FORECAST,
      },
      {
        key: WeatherCacheKey.latestForecast(entry.gridX, entry.gridY),
        value: entry.forecast,
        ttlMs: WEATHER_CACHE_TTL_MS.LATEST_FORECAST,
      },
    ]);
    await this.#cache.mset(cacheEntries);
  }

  getLatestForecastBatch(
    grids: readonly WeatherGridRef[],
  ): Promise<(WeatherForecast | undefined)[]> {
    return this.#cache.mget(
      grids.map((grid) => WeatherCacheKey.latestForecast(grid.gridX, grid.gridY)),
      WEATHER_FORECAST_SCHEMA,
    );
  }

  getConditions(gridX: number, gridY: number, date: Date): Promise<WeatherConditions | undefined> {
    const localDate = localDateAt(date, KMA_TIMEZONE).toString();
    return this.#cache.get(
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
    const localDate = localDateAt(date, KMA_TIMEZONE).toString();
    await this.#cache.set(
      WeatherCacheKey.conditions(gridX, gridY, localDate),
      conditions,
      WEATHER_CACHE_TTL_MS.CONDITIONS,
    );
  }
}
