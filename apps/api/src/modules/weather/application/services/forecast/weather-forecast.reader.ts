import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";
import { WeatherLogEvent } from "../../observability/forecast/weather-log.events.js";
import { type WeatherCachePort } from "../../ports/forecast/weather-cache.port.js";
import type {
  GridInput,
  WeatherForecastReaderPort,
} from "../../ports/forecast/weather-forecast.reader.port.js";
import {
  type WeatherForecast,
  type WeatherProvider,
} from "../../ports/forecast/weather-provider.port.js";

/**
 * 예보 읽기 모델 — 캐시-스루 프로바이더 조회를 캡슐화하는 애플리케이션 서비스.
 *
 * 예보 단건/배치 조회에서 공통으로 쓰이는 캐시(3h 정규 + 24h latest fallback)·
 * 공급자 호출·장애 폴백 오케스트레이션을 한 곳에 둔다(SRP/DRY).
 */
interface WeatherForecastReaderDependencies {
  readonly weatherProvider: Pick<WeatherProvider, "getForecast" | "name">;
  readonly weatherCache: Pick<
    WeatherCachePort,
    | "getForecast"
    | "saveForecast"
    | "getLatestForecast"
    | "getForecastBatch"
    | "saveForecastBatch"
    | "getLatestForecastBatch"
  >;
  readonly logger: Pick<ApplicationLogger, "warn" | "debug">;
}

export class WeatherForecastReader implements WeatherForecastReaderPort {
  readonly #dependencies: WeatherForecastReaderDependencies;

  constructor(dependencies: WeatherForecastReaderDependencies) {
    this.#dependencies = dependencies;
  }

  /** 단일 위치의 예보를 조회한다 (캐시 → 프로바이더 → latest 폴백 → WEATHER_1901). */
  async fetchForLocation(location: UserLocation, date: Date): Promise<WeatherForecast> {
    const cached = await this.#dependencies.weatherCache.getForecast(
      location.gridX,
      location.gridY,
      date,
    );
    if (cached !== undefined) {
      return cached;
    }

    try {
      const forecast = await this.#dependencies.weatherProvider.getForecast(
        location.latitude,
        location.longitude,
        date,
      );

      // 성공 시 정규 캐시 (3h) + latest 캐시 (24h) 모두 저장
      await this.#dependencies.weatherCache.saveForecast(
        location.gridX,
        location.gridY,
        date,
        forecast,
      );

      return forecast;
    } catch (error) {
      this.#dependencies.logger.warn({
        event: WeatherLogEvent.FORECAST_PROVIDER_FAILED,
        provider: this.#dependencies.weatherProvider.name,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
    }

    const latest = await this.#dependencies.weatherCache.getLatestForecast(
      location.gridX,
      location.gridY,
    );
    if (latest !== undefined) {
      this.#dependencies.logger.warn({ event: WeatherLogEvent.FORECAST_FALLBACK_USED });
      return latest;
    }

    throw new ApplicationException(ErrorCode.WEATHER_1901);
  }

  /**
   * 여러 격자의 예보를 기존 배치 경로로 조회한다 (캐시 배치 읽기 → 미스 조회 → 배치 저장).
   * 실패 격자는 latest 캐시로 폴백한다.
   */
  async getForecastsByGridBatch(
    grids: readonly GridInput[],
    date: Date,
  ): Promise<Map<string, WeatherForecast>> {
    const result = new Map<string, WeatherForecast>();

    if (grids.length === 0) {
      return result;
    }

    const cached = await this.#dependencies.weatherCache.getForecastBatch(grids, date);

    const misses: GridInput[] = [];
    for (const [i, grid] of grids.entries()) {
      const key = `${grid.gridX}:${grid.gridY}`;
      const cachedItem = cached[i];
      if (cachedItem !== undefined) {
        result.set(key, cachedItem);
      } else {
        misses.push(grid);
      }
    }

    if (misses.length === 0) {
      return result;
    }

    const settled = await Promise.allSettled(
      misses.map((g) => this.#dependencies.weatherProvider.getForecast(g.lat, g.lon, date)),
    );

    const cacheEntries: Array<{
      gridX: number;
      gridY: number;
      forecast: WeatherForecast;
    }> = [];
    const latestFallbackTargets: GridInput[] = [];

    for (const [i, settledResult] of settled.entries()) {
      const miss = misses[i];
      if (!miss) {
        continue;
      }

      if (settledResult.status === "fulfilled") {
        const forecast = settledResult.value;
        // 정규 캐시 (3h) + latest 캐시 (24h) — 어댑터가 이중 저장
        cacheEntries.push({
          gridX: miss.gridX,
          gridY: miss.gridY,
          forecast,
        });
        result.set(`${miss.gridX}:${miss.gridY}`, forecast);
      } else {
        latestFallbackTargets.push(miss);
      }
    }

    if (cacheEntries.length > 0) {
      await this.#dependencies.weatherCache.saveForecastBatch(cacheEntries, date);
    }

    if (latestFallbackTargets.length > 0) {
      const fallbackCached =
        await this.#dependencies.weatherCache.getLatestForecastBatch(latestFallbackTargets);

      let fallbackCount = 0;
      for (const [j, miss] of latestFallbackTargets.entries()) {
        const fallback = fallbackCached[j];
        if (fallback !== undefined) {
          result.set(`${miss.gridX}:${miss.gridY}`, fallback);
          fallbackCount += 1;
        }
      }
      if (fallbackCount > 0) {
        this.#dependencies.logger.warn({
          event: WeatherLogEvent.FORECAST_FALLBACK_USED,
          fallbackCount,
        });
      }
    }

    this.#dependencies.logger.debug({
      event: WeatherLogEvent.FORECAST_BATCH_READ,
      gridCount: grids.length,
      cacheMissCount: misses.length,
    });

    return result;
  }
}
