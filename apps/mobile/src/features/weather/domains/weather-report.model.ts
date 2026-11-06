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
  WEATHER_BRIEFING_RULES,
  WEATHER_FROZEN_PRECIPITATION_TYPES,
  type WeatherCondition,
  type WeatherPrecipitationType,
} from '@aido/api';
import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time.constants';
import { hasSameWallClock, toDateKey } from '@src/shared/date/instant';
import { clamp, maxBy, minBy } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

import type { WeatherSceneInput } from './weather-scene.model';

const currentWeatherSchema = weatherCurrentConditionsSchema.extend({
  observedAt: z.date(),
});
export type CurrentWeather = z.infer<typeof currentWeatherSchema>;

const minuteForecastSchema = weatherMinuteForecastSchema.extend({ startsAt: z.date() });
export type MinuteForecast = z.infer<typeof minuteForecastSchema>;

const nextHourPeriodSchema = weatherNextHourPeriodSchema.extend({
  startsAt: z.date(),
  endsAt: z.date().nullable(),
});

const nextHourForecastSchema = z.object({
  periods: z.array(nextHourPeriodSchema),
  minutes: z.array(minuteForecastSchema),
});
type NextHourForecast = z.infer<typeof nextHourForecastSchema>;

const hourlyForecastSchema = weatherHourlyForecastSchema.extend({ startsAt: z.date() });
export type HourlyForecastEntry = z.infer<typeof hourlyForecastSchema>;

const dailyForecastSchema = weatherDailyForecastSchema.extend({
  sunrise: z.date().nullable(),
  sunset: z.date().nullable(),
  moonrise: z.date().nullable(),
  moonset: z.date().nullable(),
});
export type DailyForecastEntry = z.infer<typeof dailyForecastSchema>;

const weatherAlertModelSchema = weatherAlertSchema.extend({
  effectiveAt: z.date(),
  expiresAt: z.date(),
});
export type WeatherAlert = z.infer<typeof weatherAlertModelSchema>;

const airQualitySchema = weatherAirQualitySchema;
export type AirQuality = z.infer<typeof airQualitySchema>;

const weatherReportModelSchema = z.object({
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
export type WeatherReport = z.infer<typeof weatherReportModelSchema>;
export type AttributionInfo = WeatherReport['attribution'];

const NEXT_HOUR_RANGE_MS = HOUR_MS;
const STALE_AFTER_MS = 30 * MINUTE_MS;
const NOWCAST_EXPIRES_AFTER_MS = 6 * HOUR_MS;
/** 시간별 예보에서 이 확률 이상이면 비가 오는 시간으로 본다. 서버 날씨 알림과 같은 기준이다. */
const WET_HOUR_CHANCE = WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE;

/** 0~1 막대·궤적 위 자리. 범위를 벗어나면 양 끝에 두고, 폭이 1보다 좁으면 1로 본다. */
export function toUnitPosition(value: number, min: number, max: number): number {
  return clamp((value - min) / Math.max(max - min, 1), 0, 1);
}

export function isFrozenPrecipitation(type: WeatherPrecipitationType): boolean {
  return WEATHER_FROZEN_PRECIPITATION_TYPES.some((frozen) => frozen === type);
}

/** 강수 형태를 아이콘이 그릴 상태로 바꾼다. 얼어 내리면 눈, 그 밖에는 비로 그린다. */
function toPrecipitationCondition(type: WeatherPrecipitationType): WeatherCondition {
  return match(type)
    .with('SNOW', 'SLEET', 'HAIL', () => 'SNOW' as const)
    .with('RAIN', 'MIXED', 'NONE', () => 'RAIN' as const)
    .exhaustive();
}

export function isWetHour(hour: HourlyForecastEntry): boolean {
  return hour.precipitationChance >= WET_HOUR_CHANCE;
}

function hourEndsAt(hour: HourlyForecastEntry): number {
  return hour.startsAt.getTime() + HOUR_MS;
}

export function selectUpcomingHours(
  hourly: readonly HourlyForecastEntry[],
  now: Date,
): HourlyForecastEntry[] {
  return hourly.filter((hour) => hourEndsAt(hour) > now.getTime());
}

type PrecipitationSource = Pick<WeatherReport, 'location' | 'nextHour' | 'hourly'>;

/** 분 단위 예보에서 온 시각은 분까지, 시간별 예보에서 온 시각은 정시로 안내한다. */
export type PrecipitationPrecision = 'minute' | 'hour';

export type PrecipitationWindow =
  | { kind: 'dry' }
  | {
      kind: 'ongoing';
      precipitationType: WeatherPrecipitationType | null;
      endsAt: Date | null;
      endPrecision: PrecipitationPrecision;
      endsOnLaterDay: boolean;
    }
  | {
      kind: 'upcoming';
      precision: PrecipitationPrecision;
      precipitationType: WeatherPrecipitationType | null;
      startsAt: Date;
      endsAt: Date | null;
      endPrecision: PrecipitationPrecision;
      endsOnLaterDay: boolean;
    };

function getNextHourHorizon(nextHour: NextHourForecast, now: Date): number {
  const lastMinute = nextHour.minutes.at(-1);
  return lastMinute == null
    ? now.getTime() + NEXT_HOUR_RANGE_MS
    : lastMinute.startsAt.getTime() + MINUTE_MS;
}

function findFirstDryHourStart(hourly: readonly HourlyForecastEntry[], after: number): Date | null {
  const dryHour = hourly.find((hour) => hour.startsAt.getTime() >= after && !isWetHour(hour));
  return dryHour?.startsAt ?? null;
}

function isLaterDay(endsAt: Date | null, now: Date, timeZone: string): boolean {
  return endsAt != null && toDateKey(endsAt, timeZone) !== toDateKey(now, timeZone);
}

function toWindow(
  report: PrecipitationSource,
  now: Date,
  wet: {
    startsAt: Date;
    endsAt: Date | null;
    precision: PrecipitationPrecision;
    endPrecision: PrecipitationPrecision;
    precipitationType: WeatherPrecipitationType | null;
  },
): PrecipitationWindow {
  const endsOnLaterDay = isLaterDay(wet.endsAt, now, report.location.timezone);
  if (wet.startsAt.getTime() <= now.getTime()) {
    return {
      kind: 'ongoing',
      precipitationType: wet.precipitationType,
      endsAt: wet.endsAt,
      endPrecision: wet.endPrecision,
      endsOnLaterDay,
    };
  }
  return { kind: 'upcoming', ...wet, endsOnLaterDay };
}

/**
 * 분 단위 예보가 있으면 그 구간을 먼저 믿고, 예보 범위 끝까지 이어지는 비는 시간별 예보에서 그치는 시각을 찾는다.
 * 분 단위 예보가 없는 지역(nextHour == null)은 시간별 예보만으로 시작·그침을 정한다.
 */
function getPrecipitationWindow(report: PrecipitationSource, now: Date): PrecipitationWindow {
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
        endPrecision: period.endsAt == null ? 'hour' : 'minute',
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
    endPrecision: 'hour',
    precipitationType: wetHour.precipitationType,
  });
}

function getMinutesUntil(target: Date, now: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / MINUTE_MS));
}

function isReportStale(report: Pick<WeatherReport, 'fetchedAt'>, now: Date): boolean {
  return now.getTime() - report.fetchedAt.getTime() > STALE_AFTER_MS;
}

/** 6시간 넘게 갱신되지 않은 데이터로는 곧 올 비나 할 일 브리핑을 안내하지 않는다. */
function isNowcastExpired(report: Pick<WeatherReport, 'fetchedAt'>, now: Date): boolean {
  return now.getTime() - report.fetchedAt.getTime() > NOWCAST_EXPIRES_AFTER_MS;
}

/** 예보 위치 시간대의 오늘 날짜(YYYY-MM-DD). 일별 예보의 날짜가 이 시간대를 따른다. */
function getTodayKey(report: Pick<WeatherReport, 'location'>, now: Date): string {
  return toDateKey(now, report.location.timezone);
}

function findTodayForecast(
  report: Pick<WeatherReport, 'location' | 'daily'>,
  now: Date,
): DailyForecastEntry | null {
  const todayKey = getTodayKey(report, now);
  return report.daily.find((day) => day.date === todayKey) ?? report.daily[0] ?? null;
}

/**
 * 서버가 심각도 순으로 정렬해 보내므로 순서는 그대로 두고, 화면을 켜 둔 사이 만료된 특보만 뺀다.
 * 아직 발효 전인 특보는 미리 알 수 있도록 남긴다.
 */
function selectActiveAlerts(alerts: readonly WeatherAlert[], now: Date): WeatherAlert[] {
  return alerts.filter((alert) => alert.expiresAt.getTime() > now.getTime());
}

function isAlertInEffect(alert: WeatherAlert, now: Date): boolean {
  return alert.effectiveAt.getTime() <= now.getTime();
}

export type AirQualityGrade = 'good' | 'moderate' | 'bad' | 'veryBad';

const AIR_QUALITY_GRADES = [
  'good',
  'moderate',
  'bad',
  'veryBad',
] as const satisfies readonly AirQualityGrade[];
/** 환경부 통합 예보 기준 (μg/m³). 각 값 이하가 해당 등급이다. */
export const PM10_UPPER_BOUNDS = [30, 80, 150] as const;
export const PM25_UPPER_BOUNDS = [15, 35, 75] as const;

function gradeIndex(value: number, upperBounds: readonly number[]): number {
  const index = upperBounds.findIndex((bound) => value <= bound);
  return index === -1 ? upperBounds.length : index;
}

/** 미세먼지·초미세먼지 중 더 나쁜 등급. 두 값이 모두 없으면 null이다. */
function getAirQualityGrade(airQuality: Pick<AirQuality, 'pm10' | 'pm25'>): AirQualityGrade | null {
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

function getUvLevel(uvIndex: number): UvLevel {
  return UV_LEVELS[gradeIndex(uvIndex, UV_UPPER_BOUNDS)] ?? 'extreme';
}

export type TemperatureUnit = 'celsius' | 'fahrenheit';

/** 서버 값은 섭씨다. 반올림한 -0은 "-0°"로 보이지 않게 0으로 바꾼다. */
function toDisplayTemperature(celsius: number, unit: TemperatureUnit): number {
  const value = unit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius;
  return Math.round(value) + 0;
}

const MINUS_SIGN = '−';

/** 큰 기온은 영하 기호와 숫자를 따로 그린다. */
export type TemperatureReading = { isBelowZero: boolean; magnitude: number };

function toTemperatureReading(displayValue: number): TemperatureReading {
  return { isBelowZero: displayValue < 0, magnitude: Math.abs(displayValue) };
}

/** 영하는 하이픈 대신 마이너스 기호(−)로 써서 숫자 폭과 읽기를 맞춘다. */
function formatDegrees(displayValue: number): string {
  const { isBelowZero, magnitude } = toTemperatureReading(displayValue);
  return `${isBelowZero ? MINUS_SIGN : ''}${magnitude}°`;
}

function toSceneInput(
  report: Pick<WeatherReport, 'current' | 'location' | 'fetchedAt'>,
): WeatherSceneInput {
  const { condition, isDaylight, precipitationIntensity, cloudCover, windSpeed } = report.current;
  return {
    condition,
    isDaylight,
    precipitationIntensity,
    cloudCover,
    windSpeed,
    observedAt: report.fetchedAt,
    latitude: report.location.latitude,
  };
}

export interface TemperatureBar {
  start: number;
  end: number;
}

/** 예보 기간 전체의 최저~최고를 0~1로 두고 하루의 최저·최고가 놓일 위치를 구한다. */
function toTemperatureBars(daily: readonly DailyForecastEntry[]): TemperatureBar[] {
  const lowest = minBy(daily, (day) => day.temperatureMin)?.temperatureMin;
  const highest = maxBy(daily, (day) => day.temperatureMax)?.temperatureMax;
  if (lowest == null || highest == null) {
    return [];
  }
  return daily.map((day) => ({
    start: toUnitPosition(day.temperatureMin, lowest, highest),
    end: toUnitPosition(day.temperatureMax, lowest, highest),
  }));
}

type SunEvents =
  | { kind: 'regular'; sunrise: Date | null; sunset: Date | null }
  | { kind: 'polarDay' }
  | { kind: 'polarNight' };

/**
 * 일출·일몰이 모두 없으면 극지의 백야·극야다. 둘을 가르는 값은 계약에 없으므로 지금 낮인지로 정한다.
 * 하나만 없으면(해가 뜨기만 하거나 지기만 하는 날) 있는 쪽만 보여 준다.
 */
function getSunEvents(day: DailyForecastEntry, isDaylight: boolean): SunEvents {
  if (day.sunrise == null && day.sunset == null) {
    return { kind: isDaylight ? 'polarDay' : 'polarNight' };
  }
  return { kind: 'regular', sunrise: day.sunrise, sunset: day.sunset };
}

const COMPASS_DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number];

/** 바람이 불어오는 방향(북=0도)을 8방위로 나눈다. 무풍 등으로 방향이 없으면 null이다. */
function toCompassDirection(degrees: number | null): CompassDirection | null {
  if (degrees == null) {
    return null;
  }
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % COMPASS_DIRECTIONS.length;
  return COMPASS_DIRECTIONS[index] ?? null;
}

export type FeelsLikeComparison = 'colder' | 'similar' | 'warmer';
/** 체감 온도와 실제 기온의 차이가 이 값(°C) 미만이면 비슷하다고 본다. */
const FEELS_LIKE_SIMILAR_RANGE = 2;

function compareFeelsLike(current: CurrentWeather): FeelsLikeComparison {
  const difference = current.apparentTemperature - current.temperature;
  if (Math.abs(difference) < FEELS_LIKE_SIMILAR_RANGE) {
    return 'similar';
  }
  return difference < 0 ? 'colder' : 'warmer';
}

/**
 * 날씨 시각은 위치 시간대로 보여 준다. 지금 그 벽시계가 기기와 다를 때만 '현지' 시각임을 밝힌다.
 * 서울·도쿄처럼 이름만 다르고 오프셋이 같으면 다르지 않다.
 */
function isDifferentWallClock(
  report: { location: Pick<WeatherReport['location'], 'timezone'> },
  deviceTimeZone: string,
  now: Date,
): boolean {
  return !hasSameWallClock(now, report.location.timezone, deviceTimeZone);
}

export type AttributionBackground = 'light' | 'dark';

type AttributionMark = { kind: 'logo'; uri: string } | { kind: 'text'; serviceName: string };

/**
 * 어두운 바탕(하늘 장면·다크 테마)에는 흰 글자 로고(dark), 밝은 바탕에는 검은 글자 로고(light)를 쓴다.
 * 화면 밀도에 맞는 해상도 하나를 골라 1x 크기로 그려야 늘어나 흐려지지 않는다.
 * 로고를 받지 못하면 서비스 이름을 글자로 표기해 출처 표기가 빠지지 않게 한다.
 */
function getAttributionMark(
  attribution: AttributionInfo,
  background: AttributionBackground,
  pixelRatio: number,
): AttributionMark {
  if (attribution.logo == null) {
    return { kind: 'text', serviceName: attribution.serviceName };
  }
  return { kind: 'logo', uri: attribution.logo[background][toLogoDensity(pixelRatio)] };
}

/** 화면 밀도보다 낮은 해상도를 고르면 늘어나 흐려지므로 같거나 한 단계 높은 해상도를 고른다. */
function toLogoDensity(pixelRatio: number): '1x' | '2x' | '3x' {
  if (pixelRatio > 2) {
    return '3x';
  }
  if (pixelRatio > 1) {
    return '2x';
  }
  return '1x';
}

export const WeatherReportPolicy = {
  attributionMark: getAttributionMark,
  isDifferentWallClock,
  isWetHour,
  isFrozenPrecipitation,
  precipitationCondition: toPrecipitationCondition,
  upcomingHours: selectUpcomingHours,
  precipitationWindow: getPrecipitationWindow,
  minutesUntil: getMinutesUntil,
  isStale: isReportStale,
  isNowcastExpired,
  todayKey: getTodayKey,
  todayForecast: findTodayForecast,
  activeAlerts: selectActiveAlerts,
  isAlertInEffect,
  temperatureBars: toTemperatureBars,
  sunEvents: getSunEvents,
  compassDirection: toCompassDirection,
  feelsLike: compareFeelsLike,
  airQualityGrade: getAirQualityGrade,
  uvLevel: getUvLevel,
  displayTemperature: toDisplayTemperature,
  temperatureReading: toTemperatureReading,
  degrees: formatDegrees,
  sceneInput: toSceneInput,
} as const;
