import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type { AirQuality } from "../../application/ports/air-quality-provider.port.js";
import type { WeatherReportCachePort } from "../../application/ports/weather-report-cache.port.js";
import type { WeatherReportCacheScope } from "../../domain/weather-report-language.domain-service.js";
import type { WeatherReport } from "../../domain/weather-report.aggregate.js";
import {
  CACHED_REPORT_SCHEMA,
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

  constructor(cache: CacheStorePort, clock: ClockPort) {
    this.#cache = cache;
    this.#clock = clock;
  }

  async getOrLoadReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
    load: () => Promise<WeatherReport>,
  ): Promise<WeatherReport> {
    const cached = await this.#cache.wrap(
      WeatherReportCacheKey.report(cell.key, scope),
      CACHED_REPORT_SCHEMA,
      async () => {
        const report = toCachedWeatherReport(await load());
        await this.#cache.set(
          WeatherReportCacheKey.latestReport(cell.key, scope),
          report,
          WEATHER_REPORT_CACHE_TTL_MS.LATEST_REPORT,
        );
        return report;
      },
      (report) => this.#reportTtlMs(toWeatherReport(report, cell)),
    );
    return toWeatherReport(cached, cell);
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
    return this.#cache.wrap(
      WeatherReportCacheKey.airQuality(cell.key),
      AIR_QUALITY_SCHEMA,
      load,
      WEATHER_REPORT_CACHE_TTL_MS.AIR_QUALITY,
    );
  }

  #reportTtlMs(report: WeatherReport): number {
    return report.isPrecipitationSoon(this.#clock.now())
      ? WEATHER_REPORT_CACHE_TTL_MS.REPORT_PRECIPITATION_SOON
      : WEATHER_REPORT_CACHE_TTL_MS.REPORT_CALM;
  }
}
