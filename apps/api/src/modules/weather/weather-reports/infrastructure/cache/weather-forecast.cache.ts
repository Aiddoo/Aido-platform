import { PRECIPITATION_TYPES, SKY_CONDITIONS } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { toIsoString } from "#api/shared/domain/time/instant";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import type { GridCoordinate } from "../../../shared/domain/grid-coordinate.vo.js";
import type { WeatherForecastCachePort } from "../../application/ports/weather-forecast-cache.port.js";
import type { ForecastTiming } from "../../application/ports/weather-forecast-provider.port.js";
import type {
  WeatherConditionsReadModel,
  WeatherForecastReadModel,
} from "../../application/read-models/weather-forecast.read-model.js";
import { toKmaBaseDateTime } from "../adapters/kma-issuance.mapper.js";
import { KMA_TIMEZONE } from "../adapters/kma.constants.js";
import { WEATHER_CACHE_TTL_MS, WeatherCacheKey } from "./weather-forecast.keyspace.js";

const SKY_CONDITION_SCHEMA = z.enum(SKY_CONDITIONS);
const PRECIPITATION_TYPE_SCHEMA = z.enum(PRECIPITATION_TYPES);

// 배포 사이 이전·다음 버전이 같은 키를 읽으므로 저장 모양은 Date JSON과 같은 ISO 문자열(ms 3자리)이다
const CACHED_FORECAST_SCHEMA = z.object({
  date: z.iso.datetime(),
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
      skyCondition: SKY_CONDITION_SCHEMA,
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
});

type CachedForecast = z.infer<typeof CACHED_FORECAST_SCHEMA>;

const WEATHER_CONDITIONS_SCHEMA = z.object({
  feelsLikeTemperature: z.number().nullable(),
  uvIndex: z.number().nullable(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
  pm10: z.number().nullable(),
  pm25: z.number().nullable(),
}) satisfies z.ZodType<WeatherConditionsReadModel>;

function toCachedForecast(forecast: WeatherForecastReadModel): CachedForecast {
  return {
    ...forecast,
    date: toIsoString(forecast.date),
    hourlyForecasts: [...forecast.hourlyForecasts],
    dailyForecasts: [...forecast.dailyForecasts],
  };
}

function toWeatherForecast(cached: CachedForecast): WeatherForecastReadModel {
  return { ...cached, date: Temporal.Instant.from(cached.date) };
}

function toWeatherForecastOrNull(
  cached: CachedForecast | undefined,
): WeatherForecastReadModel | null {
  return cached == null ? null : toWeatherForecast(cached);
}

function forecastKey(grid: GridCoordinate, timing: ForecastTiming): string {
  const { baseDate, baseTime } = toKmaBaseDateTime(timing.issuance);
  const targetDate = localDateIn(timing.target, KMA_TIMEZONE).toString();
  return WeatherCacheKey.forecast({
    gridX: grid.gridX,
    gridY: grid.gridY,
    baseDate,
    baseTime,
    targetDate,
  });
}

function latestForecastKey(grid: GridCoordinate): string {
  return WeatherCacheKey.latestForecast(grid.gridX, grid.gridY);
}

function conditionsKey(grid: GridCoordinate, at: Temporal.Instant): string {
  const localDate = localDateIn(at, KMA_TIMEZONE).toString();
  return WeatherCacheKey.conditions(grid.gridX, grid.gridY, localDate);
}

@Injectable()
export class WeatherForecastCache implements WeatherForecastCachePort {
  readonly #cache: CacheStorePort;

  constructor(cache: CacheStorePort) {
    this.#cache = cache;
  }

  async findForecast(
    grid: GridCoordinate,
    timing: ForecastTiming,
  ): Promise<WeatherForecastReadModel | null> {
    const cached = await this.#cache.get(forecastKey(grid, timing), CACHED_FORECAST_SCHEMA);
    return toWeatherForecastOrNull(cached);
  }

  async getOrLoadForecast(
    grid: GridCoordinate,
    timing: ForecastTiming,
    load: () => Promise<WeatherForecastReadModel>,
  ): Promise<WeatherForecastReadModel> {
    const cached = await this.#cache.wrap({
      key: forecastKey(grid, timing),
      schema: CACHED_FORECAST_SCHEMA,
      factory: async () => {
        const forecast = toCachedForecast(await load());
        await this.#cache.set(
          latestForecastKey(grid),
          forecast,
          WEATHER_CACHE_TTL_MS.LATEST_FORECAST,
        );
        return forecast;
      },
      ttlMs: WEATHER_CACHE_TTL_MS.FORECAST,
    });
    return toWeatherForecast(cached);
  }

  hasRecentForecastFailure(grid: GridCoordinate): Promise<boolean> {
    return this.#cache.has(WeatherCacheKey.forecastFailure(grid.gridX, grid.gridY));
  }

  markForecastFailure(grid: GridCoordinate): Promise<void> {
    return this.#cache.set(
      WeatherCacheKey.forecastFailure(grid.gridX, grid.gridY),
      true,
      WEATHER_CACHE_TTL_MS.FORECAST_FAILURE,
    );
  }

  async findLatestForecast(grid: GridCoordinate): Promise<WeatherForecastReadModel | null> {
    const cached = await this.#cache.get(latestForecastKey(grid), CACHED_FORECAST_SCHEMA);
    return toWeatherForecastOrNull(cached);
  }

  async findConditions(
    grid: GridCoordinate,
    at: Temporal.Instant,
  ): Promise<WeatherConditionsReadModel | null> {
    return (await this.#cache.get(conditionsKey(grid, at), WEATHER_CONDITIONS_SCHEMA)) ?? null;
  }

  async setConditions(
    grid: GridCoordinate,
    at: Temporal.Instant,
    conditions: WeatherConditionsReadModel,
  ): Promise<void> {
    await this.#cache.set(conditionsKey(grid, at), conditions, WEATHER_CACHE_TTL_MS.CONDITIONS);
  }
}
