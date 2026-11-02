import {
  weatherAirQualitySchema,
  weatherAlertSchema,
  weatherAttributionSchema,
  weatherCurrentConditionsSchema,
  weatherDailyForecastSchema,
  weatherHourlyForecastSchema,
  weatherLocationSchema,
  weatherMinuteForecastSchema,
  weatherNextHourPeriodSchema,
  WEATHER_ALERT_SEVERITIES,
  type WeatherAlertSeverity,
  type WeatherPrecipitationType,
} from '@aido/api';
import { formatDateKey } from '@src/shared/utils/date-format';
import { orderBy } from 'es-toolkit';
import { z } from 'zod';

export const currentWeatherSchema = weatherCurrentConditionsSchema.extend({
  observedAt: z.date(),
});
export type CurrentWeather = z.infer<typeof currentWeatherSchema>;

export const minuteForecastSchema = weatherMinuteForecastSchema.extend({ startsAt: z.date() });
export type MinuteForecast = z.infer<typeof minuteForecastSchema>;

export const nextHourPeriodSchema = weatherNextHourPeriodSchema.extend({
  startsAt: z.date(),
  endsAt: z.date().nullable(),
});
export type NextHourPeriod = z.infer<typeof nextHourPeriodSchema>;

export const nextHourForecastSchema = z.object({
  periods: z.array(nextHourPeriodSchema),
  minutes: z.array(minuteForecastSchema),
});
export type NextHourForecast = z.infer<typeof nextHourForecastSchema>;

export const hourlyForecastSchema = weatherHourlyForecastSchema.extend({ startsAt: z.date() });
export type HourlyForecast = z.infer<typeof hourlyForecastSchema>;

export const dailyForecastSchema = weatherDailyForecastSchema.extend({
  sunrise: z.date().nullable(),
  sunset: z.date().nullable(),
});
export type DailyForecast = z.infer<typeof dailyForecastSchema>;

export const weatherAlertModelSchema = weatherAlertSchema.extend({
  effectiveAt: z.date(),
  expiresAt: z.date(),
});
export type WeatherAlert = z.infer<typeof weatherAlertModelSchema>;

export const airQualitySchema = weatherAirQualitySchema;
export type AirQuality = z.infer<typeof airQualitySchema>;

export const weatherReportSchema = z.object({
  location: weatherLocationSchema,
  current: currentWeatherSchema,
  nextHour: nextHourForecastSchema.nullable(),
  hourly: z.array(hourlyForecastSchema),
  daily: z.array(dailyForecastSchema),
  alerts: z.array(weatherAlertModelSchema),
  airQuality: airQualitySchema.nullable(),
  attribution: weatherAttributionSchema,
  fetchedAt: z.date(),
});
export type WeatherReport = z.infer<typeof weatherReportSchema>;

const HOUR_MS = 60 * 60_000;
const MINUTE_MS = 60_000;
const NEXT_HOUR_RANGE_MS = HOUR_MS;
const STALE_AFTER_MS = 30 * MINUTE_MS;
/** 시간별 예보에서 이 확률 이상이면 비가 오는 시간으로 본다. */
export const WET_HOUR_CHANCE = 50;

export function isWetHour(hour: HourlyForecast): boolean {
  return hour.precipitationChance >= WET_HOUR_CHANCE;
}

function hourEndsAt(hour: HourlyForecast): number {
  return hour.startsAt.getTime() + HOUR_MS;
}

export function selectUpcomingHours(
  hourly: readonly HourlyForecast[],
  now: Date,
): HourlyForecast[] {
  return hourly.filter((hour) => hourEndsAt(hour) > now.getTime());
}

export type PrecipitationWindow =
  | { kind: 'dry' }
  | {
      kind: 'ongoing';
      precipitationType: WeatherPrecipitationType;
      endsAt: Date | null;
      endsOnLaterDay: boolean;
    }
  | {
      kind: 'upcoming';
      precision: 'minute' | 'hour';
      precipitationType: WeatherPrecipitationType;
      startsAt: Date;
      endsAt: Date | null;
      endsOnLaterDay: boolean;
    };

function getNextHourHorizon(nextHour: NextHourForecast, now: Date): number {
  const lastMinute = nextHour.minutes.at(-1);
  return lastMinute == null
    ? now.getTime() + NEXT_HOUR_RANGE_MS
    : lastMinute.startsAt.getTime() + MINUTE_MS;
}

function findFirstDryHourStart(hourly: readonly HourlyForecast[], after: number): Date | null {
  const dryHour = hourly.find((hour) => hour.startsAt.getTime() >= after && !isWetHour(hour));
  return dryHour?.startsAt ?? null;
}

function isLaterDay(endsAt: Date | null, now: Date, timeZone: string): boolean {
  return endsAt != null && formatDateKey(endsAt, timeZone) !== formatDateKey(now, timeZone);
}

function toWindow(
  report: WeatherReport,
  now: Date,
  wet: {
    startsAt: Date;
    endsAt: Date | null;
    precision: 'minute' | 'hour';
    precipitationType: WeatherPrecipitationType;
  },
): PrecipitationWindow {
  const endsOnLaterDay = isLaterDay(wet.endsAt, now, report.location.timezone);
  if (wet.startsAt.getTime() <= now.getTime()) {
    return {
      kind: 'ongoing',
      precipitationType: wet.precipitationType,
      endsAt: wet.endsAt,
      endsOnLaterDay,
    };
  }
  return { kind: 'upcoming', ...wet, endsOnLaterDay };
}

/**
 * 분 단위 예보가 있으면 그 구간을 먼저 믿고, 예보 범위 끝까지 이어지는 비는 시간별 예보에서 그치는 시각을 찾는다.
 * 분 단위 예보가 없는 지역(nextHour == null)은 시간별 예보만으로 시작·그침을 정한다.
 */
export function getPrecipitationWindow(report: WeatherReport, now: Date): PrecipitationWindow {
  const nowMs = now.getTime();
  const { nextHour, hourly } = report;

  if (nextHour != null) {
    const period = nextHour.periods.find(
      (candidate) =>
        candidate.condition === 'PRECIPITATION' &&
        (candidate.endsAt == null || candidate.endsAt.getTime() > nowMs),
    );
    if (period != null) {
      return toWindow(report, now, {
        startsAt: period.startsAt,
        endsAt: period.endsAt ?? findFirstDryHourStart(hourly, getNextHourHorizon(nextHour, now)),
        precision: 'minute',
        precipitationType: period.precipitationType,
      });
    }
  }

  const searchFrom = nextHour == null ? nowMs : getNextHourHorizon(nextHour, now);
  const wetHour = hourly.find((hour) => hourEndsAt(hour) > searchFrom && isWetHour(hour));
  if (wetHour == null) {
    return { kind: 'dry' };
  }
  return toWindow(report, now, {
    startsAt: new Date(Math.max(wetHour.startsAt.getTime(), searchFrom)),
    endsAt: findFirstDryHourStart(hourly, hourEndsAt(wetHour)),
    precision: 'hour',
    precipitationType: wetHour.precipitationType,
  });
}

export function getMinutesUntil(target: Date, now: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / MINUTE_MS));
}

export function isReportStale(report: WeatherReport, now: Date): boolean {
  return now.getTime() - report.fetchedAt.getTime() > STALE_AFTER_MS;
}

export function findTodayForecast(report: WeatherReport, now: Date): DailyForecast | null {
  const todayKey = formatDateKey(now, report.location.timezone);
  return report.daily.find((day) => day.date === todayKey) ?? report.daily[0] ?? null;
}

const SEVERITY_RANK = Object.fromEntries(
  WEATHER_ALERT_SEVERITIES.map((severity, index) => [severity, index]),
) satisfies Partial<Record<WeatherAlertSeverity, number>>;

function getSeverityRank(alert: WeatherAlert): number {
  return SEVERITY_RANK[alert.severity] ?? WEATHER_ALERT_SEVERITIES.length;
}

/** 만료된 특보를 빼고 심각도가 높은 순, 같은 심각도는 먼저 발효된 순으로 둔다. */
export function selectActiveAlerts(alerts: readonly WeatherAlert[], now: Date): WeatherAlert[] {
  return orderBy(
    alerts.filter((alert) => alert.expiresAt.getTime() > now.getTime()),
    [getSeverityRank, (alert) => alert.effectiveAt.getTime()],
    ['asc', 'asc'],
  );
}

export type AirQualityGrade = 'good' | 'moderate' | 'bad' | 'veryBad';

const AIR_QUALITY_GRADES = [
  'good',
  'moderate',
  'bad',
  'veryBad',
] as const satisfies readonly AirQualityGrade[];
/** 환경부 통합 예보 기준 (μg/m³). 각 값 이하가 해당 등급이다. */
const PM10_UPPER_BOUNDS = [30, 80, 150] as const;
const PM25_UPPER_BOUNDS = [15, 35, 75] as const;

function gradeIndex(value: number, upperBounds: readonly number[]): number {
  const index = upperBounds.findIndex((bound) => value <= bound);
  return index === -1 ? upperBounds.length : index;
}

/** 미세먼지·초미세먼지 중 더 나쁜 등급. 두 값이 모두 없으면 null이다. */
export function getAirQualityGrade(airQuality: AirQuality): AirQualityGrade | null {
  const indexes = [
    airQuality.pm10 == null ? null : gradeIndex(airQuality.pm10, PM10_UPPER_BOUNDS),
    airQuality.pm25 == null ? null : gradeIndex(airQuality.pm25, PM25_UPPER_BOUNDS),
  ].filter((index) => index != null);
  if (indexes.length === 0) {
    return null;
  }
  return AIR_QUALITY_GRADES[Math.max(...indexes)] ?? null;
}

export type UvLevel = 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';

const UV_LEVELS = [
  'low',
  'moderate',
  'high',
  'veryHigh',
  'extreme',
] as const satisfies readonly UvLevel[];
/** WHO 자외선 지수 기준. 각 값 이하가 해당 단계다. */
const UV_UPPER_BOUNDS = [2, 5, 7, 10] as const;

export function getUvLevel(uvIndex: number): UvLevel {
  return UV_LEVELS[gradeIndex(uvIndex, UV_UPPER_BOUNDS)] ?? 'extreme';
}

export type TemperatureUnit = 'celsius' | 'fahrenheit';

/** 서버 값은 섭씨다. 반올림한 -0은 "-0°"로 보이지 않게 0으로 바꾼다. */
export function toDisplayTemperature(celsius: number, unit: TemperatureUnit): number {
  const value = unit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius;
  return Math.round(value) + 0;
}

export type WeatherSceneSource = Pick<
  CurrentWeather,
  'condition' | 'isDaylight' | 'precipitationIntensity' | 'cloudCover' | 'windSpeed'
>;

export function toSceneSource(report: WeatherReport): WeatherSceneSource {
  const { condition, isDaylight, precipitationIntensity, cloudCover, windSpeed } = report.current;
  return { condition, isDaylight, precipitationIntensity, cloudCover, windSpeed };
}

export const WeatherReportPolicy = {
  isWetHour,
  upcomingHours: selectUpcomingHours,
  precipitationWindow: getPrecipitationWindow,
  minutesUntil: getMinutesUntil,
  isStale: isReportStale,
  todayForecast: findTodayForecast,
  activeAlerts: selectActiveAlerts,
  airQualityGrade: getAirQualityGrade,
  uvLevel: getUvLevel,
  displayTemperature: toDisplayTemperature,
  sceneSource: toSceneSource,
} as const;
