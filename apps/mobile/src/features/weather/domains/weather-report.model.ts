import {
  WEATHER_BRIEFING_RULES,
  WEATHER_FROZEN_PRECIPITATION_TYPES,
  type WeatherPrecipitationType,
} from '@aido/api/vocabulary';
import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import {
  type Instant,
  fromEpochMs,
  hasSameWallClock,
  toDateKey,
  toEpochMs,
} from '@src/shared/date/instant';

import type {
  DailyForecastEntry,
  HourlyForecastEntry,
  NextHourForecast,
  WeatherAlert,
  WeatherReport,
} from '../schemas/weather-report.schema';

const NEXT_HOUR_RANGE_MS = HOUR_MS;
const STALE_AFTER_MS = 30 * MINUTE_MS;
const NOWCAST_EXPIRES_AFTER_MS = 6 * HOUR_MS;
/** 시간별 예보에서 이 확률 이상이면 비가 오는 시간으로 본다. 서버 날씨 알림과 같은 기준이다. */
const WET_HOUR_CHANCE = WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE;

export function isFrozenPrecipitation(type: WeatherPrecipitationType): boolean {
  return WEATHER_FROZEN_PRECIPITATION_TYPES.some((frozen) => frozen === type);
}

export function isWetHour(hour: HourlyForecastEntry): boolean {
  return hour.precipitationChance >= WET_HOUR_CHANCE;
}

function getHourEndsAt(hour: HourlyForecastEntry): number {
  return toEpochMs(hour.startsAt) + HOUR_MS;
}

export function getUpcomingHours(
  hourly: readonly HourlyForecastEntry[],
  now: Instant,
): HourlyForecastEntry[] {
  return hourly.filter((hour) => getHourEndsAt(hour) > toEpochMs(now));
}

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
      endsOnLaterDay: boolean;
    }
  | {
      kind: 'upcoming';
      precision: PrecipitationPrecision;
      precipitationType: WeatherPrecipitationType | null;
      startsAt: Instant;
      endsAt: Instant | null;
      endPrecision: PrecipitationPrecision;
      endsOnLaterDay: boolean;
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
  const endsOnLaterDay = isLaterDay(wet.endsAt, now, report.location.timezone);
  if (toEpochMs(wet.startsAt) <= toEpochMs(now)) {
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
function getPrecipitationWindow(report: PrecipitationSource, now: Instant): PrecipitationWindow {
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
function getHourlyPrecipitationOutlook(
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

function getMinutesUntil(target: Instant, now: Instant): number {
  return Math.max(0, Math.ceil((toEpochMs(target) - toEpochMs(now)) / MINUTE_MS));
}

function isReportStale(report: Pick<WeatherReport, 'fetchedAt'>, now: Instant): boolean {
  return toEpochMs(now) - toEpochMs(report.fetchedAt) > STALE_AFTER_MS;
}

/** 6시간 넘게 갱신되지 않은 데이터로는 곧 올 비나 할 일 브리핑을 안내하지 않는다. */
function isNowcastExpired(report: Pick<WeatherReport, 'fetchedAt'>, now: Instant): boolean {
  return toEpochMs(now) - toEpochMs(report.fetchedAt) > NOWCAST_EXPIRES_AFTER_MS;
}

/** 예보 위치 시간대의 오늘 날짜(YYYY-MM-DD). 일별 예보의 날짜가 이 시간대를 따른다. */
function getTodayKey(report: Pick<WeatherReport, 'location'>, now: Instant): string {
  return toDateKey(now, report.location.timezone);
}

/** 오늘 예보. 일별 예보에 오늘이 없으면(날짜 경계의 지연) 첫 예보를 오늘처럼 쓴다. */
function getTodayOrFirstForecast(
  report: Pick<WeatherReport, 'location' | 'daily'>,
  now: Instant,
): DailyForecastEntry | null {
  const todayKey = getTodayKey(report, now);
  return report.daily.find((day) => day.date === todayKey) ?? report.daily[0] ?? null;
}

/**
 * 서버가 심각도 순으로 정렬해 보내므로 순서는 그대로 두고, 화면을 켜 둔 사이 만료된 특보만 뺀다.
 * 아직 발효 전인 특보는 미리 알 수 있도록 남긴다.
 */
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

/**
 * 일출·일몰이 모두 없으면 극지의 백야·극야다. 둘을 가르는 값은 계약에 없으므로 지금 낮인지로 정한다.
 * 하나만 없으면(해가 뜨기만 하거나 지기만 하는 날) 있는 쪽만 보여 준다.
 */
function getSunEvents(day: DailyForecastEntry, { isDaylight }: { isDaylight: boolean }): SunEvents {
  if (day.sunrise == null && day.sunset == null) {
    return { kind: isDaylight ? 'polarDay' : 'polarNight' };
  }
  return { kind: 'regular', sunrise: day.sunrise, sunset: day.sunset };
}

/**
 * 날씨 시각은 위치 시간대로 보여 준다. 지금 그 벽시계가 기기와 다를 때만 '현지' 시각임을 밝힌다.
 * 서울·도쿄처럼 이름만 다르고 오프셋이 같으면 다르지 않다.
 */
function isDifferentWallClock(timeZone: string, deviceTimeZone: string, now: Instant): boolean {
  return !hasSameWallClock(now, timeZone, deviceTimeZone);
}

export const WeatherReportPolicy = {
  isDifferentWallClock,
  isWetHour,
  isFrozenPrecipitation,
  getUpcomingHours,
  getPrecipitationWindow,
  getHourlyPrecipitationOutlook,
  getMinutesUntil,
  isReportStale,
  isNowcastExpired,
  getTodayKey,
  getTodayOrFirstForecast,
  getActiveAlerts,
  isAlertInEffect,
  getSunEvents,
} as const;
