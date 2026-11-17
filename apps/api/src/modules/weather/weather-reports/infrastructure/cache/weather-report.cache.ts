import { Injectable } from "@nestjs/common";
import { clamp } from "es-toolkit";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type { AirQuality } from "../../application/ports/air-quality-provider.port.js";
import { WeatherProviderBudgetPort } from "../../application/ports/weather-provider-budget.port.js";
import type { WeatherReportCachePort } from "../../application/ports/weather-report-cache.port.js";
import type { CellWeatherReportReadModel } from "../../application/read-models/cell-weather-report.read-model.js";
import type { WeatherReportCacheScope } from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport } from "../../domain/weather-report.aggregate.js";
import {
  CACHED_REPORT_SCHEMA,
  expiresAtOf,
  toCachedWeatherReport,
  toWeatherReport,
} from "./weather-report-cache.mapper.js";
import { WEATHER_REPORT_CACHE_TTL_MS, WeatherReportCacheKey } from "./weather-report.keyspace.js";

const AIR_QUALITY_SCHEMA = z
  .object({
    pm10: z.number().nullable(),
    pm25: z.number().nullable(),
  })
  .nullable() satisfies z.ZodType<AirQuality | null>;

@Injectable()
export class WeatherReportCache implements WeatherReportCachePort {
  readonly #cache: CacheStorePort;
  readonly #clock: ClockPort;
  readonly #budget: Pick<WeatherProviderBudgetPort, "currentState">;

  constructor(cache: CacheStorePort, clock: ClockPort, budget: WeatherProviderBudgetPort) {
    this.#cache = cache;
    this.#clock = clock;
    this.#budget = budget;
  }

  async getOrLoadReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
    load: () => Promise<WeatherReport>,
  ): Promise<CellWeatherReportReadModel> {
    const cached = await this.#cache.wrap(
      WeatherReportCacheKey.report(cell.key, scope),
      CACHED_REPORT_SCHEMA,
      async () => {
        const report = await load();
        const now = this.#clock.now();
        const stored = toCachedWeatherReport(
          report,
          now.add({ milliseconds: this.#reportTtlMs(report, now) }),
        );
        await this.#cache.set(
          WeatherReportCacheKey.latestReport(cell.key, scope),
          stored,
          WEATHER_REPORT_CACHE_TTL_MS.LATEST_REPORT,
        );
        return stored;
      },
      (stored) => this.#remainingMs(expiresAtOf(stored)),
    );
    return { report: toWeatherReport(cached, cell), expiresAt: expiresAtOf(cached) };
  }

  async findLatestReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
  ): Promise<WeatherReport | null> {
    const cached = await this.#cache.get(
      WeatherReportCacheKey.latestReport(cell.key, scope),
      CACHED_REPORT_SCHEMA,
    );
    return cached == null ? null : toWeatherReport(cached, cell);
  }

  getOrLoadAirQuality(
    cell: GeoCell,
    load: () => Promise<AirQuality | null>,
  ): Promise<AirQuality | null> {
    const key = WeatherReportCacheKey.airQuality(cell.key);
    return this.#cache.wrap(
      key,
      AIR_QUALITY_SCHEMA,
      async () => {
        const airQuality = await load();
        // wrap은 null을 저장하지 않으므로 측정 없음은 짧게 따로 저장한다. load 실패는 저장하지 않는다
        if (airQuality == null) {
          await this.#cache.set(key, null, WEATHER_REPORT_CACHE_TTL_MS.AIR_QUALITY_NO_DATA);
        }
        return airQuality;
      },
      WEATHER_REPORT_CACHE_TTL_MS.AIR_QUALITY,
    );
  }

  #reportTtlMs(report: WeatherReport, now: Temporal.Instant): number {
    const ttl = WEATHER_REPORT_CACHE_TTL_MS;
    if (this.#budget.currentState() !== "normal") {
      return ttl.REPORT_BUDGET_SAVING;
    }
    // 분 단위 예보가 없는 곳(한국)은 10분마다 받아도 시간별 예보가 그대로라 지금 강수 중일 때만 줄인다
    const isMinuteChangeLikely =
      report.isPrecipitatingNow() ||
      (report.hasMinuteForecast() && report.isPrecipitationSoon(now));
    if (isMinuteChangeLikely) {
      return ttl.REPORT_PRECIPITATION_SOON;
    }
    if (report.validUntil == null) {
      return ttl.REPORT_CALM;
    }
    const untilProviderExpiryMs = report.validUntil.epochMilliseconds - now.epochMilliseconds;
    return clamp(untilProviderExpiryMs, ttl.REPORT_PRECIPITATION_SOON, ttl.REPORT_CALM);
  }

  #remainingMs(expiresAt: Temporal.Instant | null): number {
    return expiresAt == null
      ? WEATHER_REPORT_CACHE_TTL_MS.REPORT_CALM
      : expiresAt.epochMilliseconds - this.#clock.now().epochMilliseconds;
  }
}
