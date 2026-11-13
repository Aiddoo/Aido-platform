import {
  WEATHER_AIR_QUALITY_SOURCES,
  WEATHER_ALERT_SEVERITIES,
  WEATHER_BRIEFING_RULES,
  WEATHER_CONDITIONS,
  WEATHER_FROZEN_PRECIPITATION_TYPES,
  WEATHER_MOON_PHASES,
  WEATHER_NEXT_HOUR_CONDITIONS,
  WEATHER_PRECIPITATION_TYPES,
  WEATHER_PRESSURE_TRENDS,
  WEATHER_PROVIDERS,
  WEATHER_RESCHEDULE_REASONS,
  type WeatherPrecipitationType,
} from '@aido/api/vocabulary';
import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { dateKeySchema, type DateKey } from '@src/shared/date/date-key';
import { type Instant, fromEpochMs, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { z } from 'zod';

const weatherConditionSchema = z.enum(WEATHER_CONDITIONS);
const precipitationTypeSchema = z.enum(WEATHER_PRECIPITATION_TYPES);

export const registeredLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
});
export type RegisteredLocation = z.infer<typeof registeredLocationSchema>;

const currentWeatherSchema = z.object({
  observedAt: instantSchema,
  condition: weatherConditionSchema,
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
});
export type CurrentWeather = z.infer<typeof currentWeatherSchema>;

const minuteForecastSchema = z.object({
  startsAt: instantSchema,
  precipitationChance: z.number(),
  precipitationIntensity: z.number(),
});
export type MinuteForecast = z.infer<typeof minuteForecastSchema>;

const nextHourPeriodSchema = z.object({
  condition: z.enum(WEATHER_NEXT_HOUR_CONDITIONS),
  precipitationType: precipitationTypeSchema.nullable(),
  startsAt: instantSchema,
  endsAt: instantSchema.nullable(),
  precipitationChance: z.number(),
  precipitationIntensity: z.number(),
});

const nextHourForecastSchema = z.object({
  periods: z.array(nextHourPeriodSchema),
  minutes: z.array(minuteForecastSchema),
});
type NextHourForecast = z.infer<typeof nextHourForecastSchema>;

const hourlyForecastSchema = z.object({
  startsAt: instantSchema,
  condition: weatherConditionSchema,
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
});
export type HourlyForecastEntry = z.infer<typeof hourlyForecastSchema>;

const dayPartForecastSchema = z.object({
  condition: weatherConditionSchema,
  temperatureMin: z.number().nullable(),
  temperatureMax: z.number().nullable(),
  precipitationChance: z.number(),
  precipitationAmount: z.number(),
  precipitationType: precipitationTypeSchema,
});

const dailyForecastSchema = z.object({
  date: dateKeySchema,
  condition: weatherConditionSchema,
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
  restOfDay: dayPartForecastSchema.nullable(),
  daytime: dayPartForecastSchema.nullable(),
  overnight: dayPartForecastSchema.nullable(),
});
export type DailyForecastEntry = z.infer<typeof dailyForecastSchema>;

const weatherAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(WEATHER_ALERT_SEVERITIES),
  source: z.string(),
  areaName: z.string().nullable(),
  effectiveAt: instantSchema,
  expiresAt: instantSchema,
  detailsUrl: z.string(),
});
export type WeatherAlert = z.infer<typeof weatherAlertSchema>;

const airQualitySchema = z.object({
  pm10: z.number().nullable(),
  pm25: z.number().nullable(),
  source: z.enum(WEATHER_AIR_QUALITY_SOURCES),
});
export type AirQuality = z.infer<typeof airQualitySchema>;

const attributionLogoSchema = z.object({ '1x': z.string(), '2x': z.string(), '3x': z.string() });

const attributionSchema = z.object({
  provider: z.enum(WEATHER_PROVIDERS),
  serviceName: z.string(),
  legalPageUrl: z.string(),
  logo: z.object({ light: attributionLogoSchema, dark: attributionLogoSchema }).nullable(),
});
export type AttributionInfo = z.infer<typeof attributionSchema>;

const rescheduleOptionSchema = z.object({
  startsAt: instantSchema,
  precipitationChance: z.number(),
  apparentTemperature: z.number(),
  isRecommended: z.boolean(),
});
export type RescheduleOption = z.infer<typeof rescheduleOptionSchema>;

/** 서버가 판단한 영향받는 할 일(시각 순)과 할 일별 옮길 시각 후보(첫 항목이 추천). reason이 null이면 영향받는 할 일이 없다 */
const weatherReportBriefingSchema = z.object({
  reason: z.enum(WEATHER_RESCHEDULE_REASONS).nullable(),
  affectedTodoIds: z.array(z.int()),
  rescheduleOptions: z.array(
    z.object({ todoId: z.int(), options: z.array(rescheduleOptionSchema) }),
  ),
});
export type WeatherReportBriefing = z.infer<typeof weatherReportBriefingSchema>;

export const weatherReportSchema = z.object({
  location: registeredLocationSchema,
  current: currentWeatherSchema,
  nextHour: nextHourForecastSchema.nullable(),
  hourly: z.array(hourlyForecastSchema),
  daily: z.array(dailyForecastSchema),
  alerts: z.array(weatherAlertSchema),
  airQuality: airQualitySchema.nullable(),
  attribution: attributionSchema,
  fetchedAt: instantSchema,
  // 서버가 오늘 할 일을 읽지 못하면 null이다
  briefing: weatherReportBriefingSchema.nullable(),
});
export type WeatherReport = z.infer<typeof weatherReportSchema>;

const NEXT_HOUR_RANGE_MS = HOUR_MS;
const STALE_AFTER_MS = 30 * MINUTE_MS;
const NOWCAST_EXPIRES_AFTER_MS = 6 * HOUR_MS;
/** 시간별 예보에서 이 확률 이상이면 비가 오는 시간으로 본다. 서버 날씨 알림과 같은 기준이다. */
const WET_HOUR_CHANCE = WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE;

function isFrozenPrecipitation(type: WeatherPrecipitationType): boolean {
  return WEATHER_FROZEN_PRECIPITATION_TYPES.some((frozen) => frozen === type);
}

function isWetHour(hour: HourlyForecastEntry): boolean {
  return hour.precipitationChance >= WET_HOUR_CHANCE;
}

function getHourEndsAt(hour: HourlyForecastEntry): number {
  return toEpochMs(hour.startsAt) + HOUR_MS;
}

function getUpcomingHours(
  hourly: readonly HourlyForecastEntry[],
  now: Instant,
): HourlyForecastEntry[] {
  return hourly.filter((hour) => getHourEndsAt(hour) > toEpochMs(now));
}

// 날씨 화면 부품은 예보에서 쓰는 칸만 select로 구독해 그 칸이 바뀔 때만 다시 그린다.
// 그래서 예보 일부를 받는 규칙은 Policy 밖 함수로 두고 필요한 칸만 받는다
type PrecipitationSource = Pick<WeatherReport, 'location' | 'nextHour' | 'hourly'>;

/** 분 단위 예보에서 온 시각은 분까지, 시간별 예보에서 온 시각은 정시로 안내한다. */
export type PrecipitationPrecision = 'minute' | 'hour';

export type PrecipitationWindow =
  | { kind: 'dry' }
  | {
      kind: 'ongoing';
      precipitationType: WeatherPrecipitationType | null;
      endsAt: Instant | null;
      endPrecision: PrecipitationPrecision;
      isEndingOnLaterDay: boolean;
    }
  | {
      kind: 'upcoming';
      precision: PrecipitationPrecision;
      precipitationType: WeatherPrecipitationType | null;
      startsAt: Instant;
      endsAt: Instant | null;
      endPrecision: PrecipitationPrecision;
      isEndingOnLaterDay: boolean;
    };

function getNextHourHorizon(nextHour: NextHourForecast, now: Instant): number {
  const lastMinute = nextHour.minutes.at(-1);
  return lastMinute == null
    ? toEpochMs(now) + NEXT_HOUR_RANGE_MS
    : toEpochMs(lastMinute.startsAt) + MINUTE_MS;
}

function findFirstDryHourStart(
  hourly: readonly HourlyForecastEntry[],
  after: number,
): Instant | null {
  const dryHour = hourly.find((hour) => toEpochMs(hour.startsAt) >= after && !isWetHour(hour));
  return dryHour?.startsAt ?? null;
}

function isLaterDay(endsAt: Instant | null, now: Instant, timeZone: string): boolean {
  return endsAt != null && toDateKey(endsAt, timeZone) !== toDateKey(now, timeZone);
}

function toWindow(
  report: PrecipitationSource,
  now: Instant,
  wet: {
    startsAt: Instant;
    endsAt: Instant | null;
    precision: PrecipitationPrecision;
    endPrecision: PrecipitationPrecision;
    precipitationType: WeatherPrecipitationType | null;
  },
): PrecipitationWindow {
  const isEndingOnLaterDay = isLaterDay(wet.endsAt, now, report.location.timezone);
  if (toEpochMs(wet.startsAt) <= toEpochMs(now)) {
    return {
      kind: 'ongoing',
      precipitationType: wet.precipitationType,
      endsAt: wet.endsAt,
      endPrecision: wet.endPrecision,
      isEndingOnLaterDay,
    };
  }
  return { kind: 'upcoming', ...wet, isEndingOnLaterDay };
}

/** 분 단위 예보를 먼저 믿고, 그 범위 끝까지 이어지는 비는 시간별 예보에서 그치는 시각을 찾는다 */
export function getPrecipitationWindow(
  report: PrecipitationSource,
  now: Instant,
): PrecipitationWindow {
  const nowMs = toEpochMs(now);
  const { nextHour, hourly } = report;

  if (nextHour != null) {
    const period = nextHour.periods.find(
      (candidate) =>
        candidate.condition === 'PRECIPITATION' &&
        (candidate.endsAt == null || toEpochMs(candidate.endsAt) > nowMs),
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
  const wetHour = hourly.find((hour) => getHourEndsAt(hour) > searchFrom && isWetHour(hour));
  if (wetHour == null) {
    return { kind: 'dry' };
  }
  return toWindow(report, now, {
    startsAt: fromEpochMs(Math.max(toEpochMs(wetHour.startsAt), searchFrom)),
    endsAt: findFirstDryHourStart(hourly, getHourEndsAt(wetHour)),
    precision: 'hour',
    endPrecision: 'hour',
    precipitationType: wetHour.precipitationType,
  });
}

/** 분 단위 예보가 없는 지역은 이 시간 안의 시간별 예보로만 곧 올 비를 알린다. */
const HOURLY_OUTLOOK_RANGE_HOURS = 6;

export interface HourlyPrecipitationOutlook {
  hour: HourlyForecastEntry;
  isOngoing: boolean;
}

/** 지금 시간부터 6시간 안에서 비가 오는 첫 시간을 고른다. 없으면 빈 카드를 만들지 않도록 null이다. */
function findHourlyPrecipitationOutlook(
  hourly: readonly HourlyForecastEntry[],
  now: Instant,
): HourlyPrecipitationOutlook | null {
  const until = toEpochMs(now) + HOURLY_OUTLOOK_RANGE_HOURS * HOUR_MS;
  const hour = hourly.find(
    (candidate) =>
      getHourEndsAt(candidate) > toEpochMs(now) &&
      toEpochMs(candidate.startsAt) < until &&
      isWetHour(candidate),
  );
  if (hour == null) {
    return null;
  }
  return { hour, isOngoing: toEpochMs(hour.startsAt) <= toEpochMs(now) };
}

export function isReportStale(report: Pick<WeatherReport, 'fetchedAt'>, now: Instant): boolean {
  return toEpochMs(now) - toEpochMs(report.fetchedAt) > STALE_AFTER_MS;
}

/** 6시간 넘게 갱신되지 않은 데이터로는 곧 올 비나 할 일 브리핑을 안내하지 않는다. */
export function isNowcastExpired(report: Pick<WeatherReport, 'fetchedAt'>, now: Instant): boolean {
  return toEpochMs(now) - toEpochMs(report.fetchedAt) > NOWCAST_EXPIRES_AFTER_MS;
}

/** 예보 위치 시간대의 오늘 날짜(YYYY-MM-DD). 일별 예보의 날짜가 이 시간대를 따른다. */
export function getTodayKey(report: Pick<WeatherReport, 'location'>, now: Instant): DateKey {
  return toDateKey(now, report.location.timezone);
}

/** 오늘 예보. 일별 예보에 오늘이 없으면(날짜 경계의 지연) 첫 예보를 오늘처럼 쓴다. */
export function findTodayOrFirstForecast(
  report: Pick<WeatherReport, 'location' | 'daily'>,
  now: Instant,
): DailyForecastEntry | null {
  const todayKey = getTodayKey(report, now);
  return report.daily.find((day) => day.date === todayKey) ?? report.daily[0] ?? null;
}

/** 서버가 심각도 순으로 보내므로 순서는 두고 만료된 특보만 뺀다. 발효 전 특보는 미리 알도록 남긴다 */
function getActiveAlerts(alerts: readonly WeatherAlert[], now: Instant): WeatherAlert[] {
  return alerts.filter((alert) => toEpochMs(alert.expiresAt) > toEpochMs(now));
}

function isAlertInEffect(alert: WeatherAlert, now: Instant): boolean {
  return toEpochMs(alert.effectiveAt) <= toEpochMs(now);
}

type SunEvents =
  | { kind: 'regular'; sunrise: Instant | null; sunset: Instant | null }
  | { kind: 'polarDay' }
  | { kind: 'polarNight' };

/** 일출·일몰이 모두 없으면 백야·극야인데, 둘을 가르는 값이 계약에 없어 지금 낮인지로 정한다 */
function getSunEvents(day: DailyForecastEntry, { isDaylight }: { isDaylight: boolean }): SunEvents {
  if (day.sunrise == null && day.sunset == null) {
    return { kind: isDaylight ? 'polarDay' : 'polarNight' };
  }
  return { kind: 'regular', sunrise: day.sunrise, sunset: day.sunset };
}

export const WeatherReportPolicy = {
  isWetHour,
  isFrozenPrecipitation,
  getUpcomingHours,
  findHourlyPrecipitationOutlook,
  getActiveAlerts,
  isAlertInEffect,
  getSunEvents,
} as const;
