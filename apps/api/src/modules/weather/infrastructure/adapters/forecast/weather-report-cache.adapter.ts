import {
  WEATHER_ALERT_SEVERITIES,
  WEATHER_CONDITIONS,
  WEATHER_MOON_PHASES,
  WEATHER_NEXT_HOUR_CONDITIONS,
  WEATHER_PRECIPITATION_TYPES,
  WEATHER_PRESSURE_TRENDS,
} from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { CacheService } from "#api/platform/cache/cache.service";
import { now } from "#api/shared/domain/date/utils/core";

import { weatherReportTtlMs } from "../../../application/models/forecast/weather-report-freshness.js";
import type { WeatherReportCacheScope } from "../../../application/models/forecast/weather-report-language.js";
import type { WeatherReport } from "../../../application/models/forecast/weather-report.model.js";
import type { AirQuality } from "../../../application/ports/forecast/air-quality-provider.port.js";
import type { WeatherReportCachePort } from "../../../application/ports/forecast/weather-report.cache.port.js";
import type { GeoCell } from "../../../domain/value-objects/forecast/geo-cell.vo.js";
import {
  WEATHER_REPORT_CACHE_TTL_MS,
  WeatherReportCacheKey,
} from "../../cache/forecast/weather-report.keyspace.js";

const conditionSchema = z.enum(WEATHER_CONDITIONS);
const precipitationTypeSchema = z.enum(WEATHER_PRECIPITATION_TYPES);

const dayPartSchema = z.object({
  condition: conditionSchema,
  temperatureMin: z.number().nullable(),
  temperatureMax: z.number().nullable(),
  precipitationChance: z.number(),
  precipitationAmount: z.number(),
  precipitationType: precipitationTypeSchema,
});

/** Redis JSON에서 문자열이 된 시각을 Date로 복원한다. 형태가 다르면 캐시 미스다. */
const WEATHER_REPORT_SCHEMA = z.object({
  current: z.object({
    observedAt: z.coerce.date(),
    condition: conditionSchema,
    isDaylight: z.boolean(),
    temperature: z.number(),
    apparentTemperature: z.number(),
    dewPoint: z.number(),
    humidity: z.number(),
    cloudCover: z.number(),
    uvIndex: z.number(),
    windSpeed: z.number(),
    windGust: z.number().nullable(),
    windDirection: z.number().nullable(),
    visibility: z.number(),
    pressure: z.number(),
    pressureTrend: z.enum(WEATHER_PRESSURE_TRENDS),
    precipitationIntensity: z.number(),
  }),
  nextHour: z
    .object({
      periods: z.array(
        z.object({
          condition: z.enum(WEATHER_NEXT_HOUR_CONDITIONS),
          precipitationType: precipitationTypeSchema.nullable(),
          startsAt: z.coerce.date(),
          endsAt: z.coerce.date().nullable(),
          precipitationChance: z.number(),
          precipitationIntensity: z.number(),
        }),
      ),
      minutes: z.array(
        z.object({
          startsAt: z.coerce.date(),
          precipitationChance: z.number(),
          precipitationIntensity: z.number(),
        }),
      ),
    })
    .nullable(),
  hourly: z.array(
    z.object({
      startsAt: z.coerce.date(),
      condition: conditionSchema,
      isDaylight: z.boolean(),
      temperature: z.number(),
      apparentTemperature: z.number(),
      humidity: z.number(),
      uvIndex: z.number(),
      windSpeed: z.number(),
      windDirection: z.number().nullable(),
      precipitationChance: z.number(),
      precipitationAmount: z.number(),
      precipitationType: precipitationTypeSchema,
    }),
  ),
  daily: z.array(
    z.object({
      date: z.iso.date(),
      condition: conditionSchema,
      temperatureMin: z.number(),
      temperatureMax: z.number(),
      precipitationChance: z.number(),
      precipitationAmount: z.number(),
      precipitationType: precipitationTypeSchema,
      snowfallAmount: z.number(),
      uvIndexMax: z.number(),
      windSpeedMax: z.number().nullable(),
      windGustMax: z.number().nullable(),
      sunrise: z.coerce.date().nullable(),
      sunset: z.coerce.date().nullable(),
      moonPhase: z.enum(WEATHER_MOON_PHASES),
      moonrise: z.coerce.date().nullable(),
      moonset: z.coerce.date().nullable(),
      restOfDay: dayPartSchema.nullable(),
      daytime: dayPartSchema.nullable(),
      overnight: dayPartSchema.nullable(),
    }),
  ),
  alerts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      severity: z.enum(WEATHER_ALERT_SEVERITIES),
      source: z.string(),
      areaName: z.string().nullable(),
      effectiveAt: z.coerce.date(),
      expiresAt: z.coerce.date(),
      detailsUrl: z.string(),
    }),
  ),
  fetchedAt: z.coerce.date(),
}) satisfies z.ZodType<WeatherReport>;

const AIR_QUALITY_SCHEMA = z
  .object({
    pm10: z.number().nullable(),
    pm25: z.number().nullable(),
  })
  .nullable() satisfies z.ZodType<AirQuality | null>;

@Injectable()
export class WeatherReportCacheAdapter implements WeatherReportCachePort {
  constructor(private readonly cacheService: CacheService) {}

  getOrLoadReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
    load: () => Promise<WeatherReport>,
  ): Promise<WeatherReport> {
    return this.cacheService.wrap(
      WeatherReportCacheKey.report(cell.key, scope),
      WEATHER_REPORT_SCHEMA,
      async () => {
        const report = await load();
        await this.cacheService.set(
          WeatherReportCacheKey.latestReport(cell.key, scope),
          report,
          WEATHER_REPORT_CACHE_TTL_MS.LATEST_REPORT,
        );
        return report;
      },
      (report) => weatherReportTtlMs(report, now()),
    );
  }

  getLatestReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
  ): Promise<WeatherReport | undefined> {
    return this.cacheService.get(
      WeatherReportCacheKey.latestReport(cell.key, scope),
      WEATHER_REPORT_SCHEMA,
    );
  }

  getOrLoadAirQuality(
    cell: GeoCell,
    load: () => Promise<AirQuality | null>,
  ): Promise<AirQuality | null> {
    return this.cacheService.wrap(
      WeatherReportCacheKey.airQuality(cell.key),
      AIR_QUALITY_SCHEMA,
      load,
      WEATHER_REPORT_CACHE_TTL_MS.AIR_QUALITY,
    );
  }
}
