import {
  WEATHER_ALERT_SEVERITIES,
  WEATHER_CONDITIONS,
  WEATHER_MOON_PHASES,
  WEATHER_NEXT_HOUR_CONDITIONS,
  WEATHER_PRECIPITATION_TYPES,
  WEATHER_PRESSURE_TRENDS,
} from "@aido/api/vocabulary";
import { omit } from "es-toolkit";
import { z } from "zod";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { GeoCell } from "../../../shared/domain/geo-cell.vo.js";
import { WeatherReport } from "../../domain/weather-report.aggregate.js";

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
export const CACHED_REPORT_SCHEMA = z.object({
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
  // 이전 버전이 쓴 값에는 아래 두 칸이 없다
  validUntil: instantSchema.nullable().default(null),
  /** 서버가 이 칸 리포트를 공급자에서 다시 받기 시작하는 순간(캐시 만료) */
  expiresAt: instantSchema.nullable().default(null),
});

type CachedWeatherReport = z.infer<typeof CACHED_REPORT_SCHEMA>;

function toIsoStringOrNull(instant: Temporal.Instant | null): string | null {
  return instant == null ? null : toIsoString(instant);
}

function toInstant(text: string): Temporal.Instant {
  return Temporal.Instant.from(text);
}

function toInstantOrNull(text: string | null): Temporal.Instant | null {
  return text == null ? null : toInstant(text);
}

export function toCachedWeatherReport(
  report: WeatherReport,
  expiresAt: Temporal.Instant,
): CachedWeatherReport {
  const value = omit(report.toPrimitives(), ["cellKey"]);
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
    validUntil: toIsoStringOrNull(value.validUntil),
    expiresAt: toIsoString(expiresAt),
  };
}

// 키에 칸이 있어 값에는 칸을 두지 않는다
export function toWeatherReport(cached: CachedWeatherReport, cell: GeoCell): WeatherReport {
  return WeatherReport.reconstitute({
    cellKey: cell.key,
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
    validUntil: toInstantOrNull(cached.validUntil),
  });
}

export function expiresAtOf(cached: CachedWeatherReport): Temporal.Instant | null {
  return toInstantOrNull(cached.expiresAt);
}
