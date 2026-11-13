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

import { CacheStorePort } from "#api/platform/cache/cache-store.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import type { AirQuality } from "../../application/ports/air-quality-provider.port.js";
import type { WeatherReportCachePort } from "../../application/ports/weather-report-cache.port.js";
import type { WeatherReportCacheScope } from "../../domain/weather-report-language.domain-service.js";
import { WeatherReport } from "../../domain/weather-report.vo.js";
import { WEATHER_REPORT_CACHE_TTL_MS, WeatherReportCacheKey } from "./weather-report.keyspace.js";

const conditionSchema = z.enum(WEATHER_CONDITIONS);
const precipitationTypeSchema = z.enum(WEATHER_PRECIPITATION_TYPES);
const instantSchema = z.iso.datetime();

const dayPartSchema = z.object({
  condition: conditionSchema,
  temperatureMin: z.number().nullable(),
  temperatureMax: z.number().nullable(),
  precipitationChance: z.number(),
  precipitationAmount: z.number(),
  precipitationType: precipitationTypeSchema,
});

// 배포 사이 이전·다음 버전이 같은 키를 읽으므로 시각은 Date JSON과 같은 ISO 문자열(ms 3자리)로 둔다. 형태가 다르면 미스다
const CACHED_REPORT_SCHEMA = z.object({
  current: z.object({
    observedAt: instantSchema,
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
          startsAt: instantSchema,
          endsAt: instantSchema.nullable(),
          precipitationChance: z.number(),
          precipitationIntensity: z.number(),
        }),
      ),
      minutes: z.array(
        z.object({
          startsAt: instantSchema,
          precipitationChance: z.number(),
          precipitationIntensity: z.number(),
        }),
      ),
    })
    .nullable(),
  hourly: z.array(
    z.object({
      startsAt: instantSchema,
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
      sunrise: instantSchema.nullable(),
      sunset: instantSchema.nullable(),
      moonPhase: z.enum(WEATHER_MOON_PHASES),
      moonrise: instantSchema.nullable(),
      moonset: instantSchema.nullable(),
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
      effectiveAt: instantSchema,
      expiresAt: instantSchema,
      detailsUrl: z.string(),
    }),
  ),
  fetchedAt: instantSchema,
});

type CachedWeatherReport = z.infer<typeof CACHED_REPORT_SCHEMA>;

const AIR_QUALITY_SCHEMA = z
  .object({
    pm10: z.number().nullable(),
    pm25: z.number().nullable(),
  })
  .nullable() satisfies z.ZodType<AirQuality | null>;

function toIsoStringOrNull(instant: Temporal.Instant | null): string | null {
  return instant == null ? null : toIsoString(instant);
}

function toInstant(text: string): Temporal.Instant {
  return Temporal.Instant.from(text);
}

function toInstantOrNull(text: string | null): Temporal.Instant | null {
  return text == null ? null : toInstant(text);
}

function toCachedWeatherReport({ value }: WeatherReport): CachedWeatherReport {
  return {
    current: { ...value.current, observedAt: toIsoString(value.current.observedAt) },
    nextHour:
      value.nextHour == null
        ? null
        : {
            periods: value.nextHour.periods.map((period) => ({
              ...period,
              startsAt: toIsoString(period.startsAt),
              endsAt: toIsoStringOrNull(period.endsAt),
            })),
            minutes: value.nextHour.minutes.map((minute) => ({
              ...minute,
              startsAt: toIsoString(minute.startsAt),
            })),
          },
    hourly: value.hourly.map((hour) => ({ ...hour, startsAt: toIsoString(hour.startsAt) })),
    daily: value.daily.map((day) => ({
      ...day,
      date: day.date.toString(),
      sunrise: toIsoStringOrNull(day.sunrise),
      sunset: toIsoStringOrNull(day.sunset),
      moonrise: toIsoStringOrNull(day.moonrise),
      moonset: toIsoStringOrNull(day.moonset),
    })),
    alerts: value.alerts.map((alert) => ({
      ...alert,
      effectiveAt: toIsoString(alert.effectiveAt),
      expiresAt: toIsoString(alert.expiresAt),
    })),
    fetchedAt: toIsoString(value.fetchedAt),
  };
}

function toWeatherReport(cached: CachedWeatherReport): WeatherReport {
  return WeatherReport.reconstitute({
    current: { ...cached.current, observedAt: toInstant(cached.current.observedAt) },
    nextHour:
      cached.nextHour == null
        ? null
        : {
            periods: cached.nextHour.periods.map((period) => ({
              ...period,
              startsAt: toInstant(period.startsAt),
              endsAt: toInstantOrNull(period.endsAt),
            })),
            minutes: cached.nextHour.minutes.map((minute) => ({
              ...minute,
              startsAt: toInstant(minute.startsAt),
            })),
          },
    hourly: cached.hourly.map((hour) => ({ ...hour, startsAt: toInstant(hour.startsAt) })),
    daily: cached.daily.map((day) => ({
      ...day,
      date: Temporal.PlainDate.from(day.date),
      sunrise: toInstantOrNull(day.sunrise),
      sunset: toInstantOrNull(day.sunset),
      moonrise: toInstantOrNull(day.moonrise),
      moonset: toInstantOrNull(day.moonset),
    })),
    alerts: cached.alerts.map((alert) => ({
      ...alert,
      effectiveAt: toInstant(alert.effectiveAt),
      expiresAt: toInstant(alert.expiresAt),
    })),
    fetchedAt: toInstant(cached.fetchedAt),
  });
}

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
      (report) => this.#reportTtlMs(toWeatherReport(report)),
    );
    return toWeatherReport(cached);
  }

  async getLatestReport(
    cell: GeoCell,
    scope: WeatherReportCacheScope,
  ): Promise<WeatherReport | undefined> {
    const cached = await this.#cache.get(
      WeatherReportCacheKey.latestReport(cell.key, scope),
      CACHED_REPORT_SCHEMA,
    );
    return cached == null ? undefined : toWeatherReport(cached);
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
