import { ErrorCode } from "@aido/api/errors";
import { chunk } from "es-toolkit";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type { UserLocation } from "../../../domain/entities/forecast/user-location.entity.js";
import { KmaForecastAvailabilityPolicy } from "../../../domain/policies/forecast/kma-forecast-availability.policy.js";
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

/** 정기 sweep의 cache miss 전체를 동시에 보내면 공급자 실패 코드가 몰려 발생해 동시 호출 수를 제한한다. */
const MAX_CONCURRENT_FORECAST_REQUESTS = 4;

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
    | "getOrLoadForecast"
    | "hasRecentForecastFailure"
    | "markForecastFailure"
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

  /**
   * 단일 위치의 예보를 조회한다 (캐시 → 격자 최근 실패 확인 → 프로바이더(동시 요청 합치기) → latest 폴백 → WEATHER_1901).
   * KMA가 줄 수 없는 날짜는 공급자를 부르지 않고 400 SYS_0002로 거절한다.
   */
  async fetchForLocation(location: UserLocation, date: Date): Promise<WeatherForecast> {
    const grid = location.requireKmaGrid();
    const availability = KmaForecastAvailabilityPolicy.resolve(date, now());
    if (availability.kind === "UNAVAILABLE") {
      throw new ApplicationException(ErrorCode.SYS_0002, { field: "date" });
    }
    const { timing } = availability;
    const cached = await this.#dependencies.weatherCache.getForecast(
      grid.gridX,
      grid.gridY,
      timing,
    );
    if (cached != null) {
      return cached;
    }

    const { weatherCache, weatherProvider, logger } = this.#dependencies;
    // 같은 격자가 1분 안에 실패했으면 요청마다 공급자 시간 초과를 기다리지 않고 latest로 넘어간다.
    if (!(await weatherCache.hasRecentForecastFailure(grid.gridX, grid.gridY))) {
      try {
        return await weatherCache.getOrLoadForecast(grid.gridX, grid.gridY, timing, () =>
          weatherProvider.getForecast(location.latitude, location.longitude, timing),
        );
      } catch (error) {
        logger.warn({
          event: WeatherLogEvent.FORECAST_PROVIDER_FAILED,
          provider: weatherProvider.name,
          errorType: toErrorType(error),
        });
        await weatherCache.markForecastFailure(grid.gridX, grid.gridY);
      }
    }

    const latest = await this.#dependencies.weatherCache.getLatestForecast(grid.gridX, grid.gridY);
    if (latest != null) {
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

    const availability = KmaForecastAvailabilityPolicy.resolve(date, now());
    if (availability.kind === "UNAVAILABLE") {
      this.#dependencies.logger.warn({
        event: WeatherLogEvent.FORECAST_DATE_UNAVAILABLE,
        gridCount: grids.length,
      });
      return result;
    }
    const { timing } = availability;

    const cached = await this.#dependencies.weatherCache.getForecastBatch(grids, timing);

    const misses: GridInput[] = [];
    for (const [i, grid] of grids.entries()) {
      const key = `${grid.gridX}:${grid.gridY}`;
      const cachedItem = cached[i];
      if (cachedItem != null) {
        result.set(key, cachedItem);
      } else {
        misses.push(grid);
      }
    }

    if (misses.length === 0) {
      return result;
    }

    const settled: PromiseSettledResult<WeatherForecast>[] = [];
    for (const missChunk of chunk(misses, MAX_CONCURRENT_FORECAST_REQUESTS)) {
      settled.push(
        ...(await Promise.allSettled(
          missChunk.map((g) =>
            this.#dependencies.weatherProvider.getForecast(g.lat, g.lon, timing),
          ),
        )),
      );
    }

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
      await this.#dependencies.weatherCache.saveForecastBatch(cacheEntries, timing);
    }

    if (latestFallbackTargets.length > 0) {
      const fallbackCached =
        await this.#dependencies.weatherCache.getLatestForecastBatch(latestFallbackTargets);

      let fallbackCount = 0;
      for (const [j, miss] of latestFallbackTargets.entries()) {
        const fallback = fallbackCached[j];
        if (fallback != null) {
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
