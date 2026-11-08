import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { type Instant, fromEpochMs, toDateKey, toEpochMs } from '@src/shared/date/instant';
import { round, sumBy } from 'es-toolkit';

import type { DailyForecastEntry, HourlyForecastEntry } from './weather-report.model';
import { WeatherReportPolicy } from './weather-report.model';

const SUNSCREEN_UV_INDEX = 3;

interface TimeWindow {
  startsAt: Instant;
  endsAt: Instant;
}

/** 오늘(위치 시간대) 남은 시간 중 자외선 차단이 필요한 첫 시각~마지막 시각. 없으면 null이다. */
function findSunscreenWindow(
  hourly: readonly HourlyForecastEntry[],
  now: Instant,
  timeZone: string,
): TimeWindow | null {
  const todayKey = toDateKey(now, timeZone);
  const strongHours = WeatherReportPolicy.getUpcomingHours(hourly, now).filter(
    (hour) => toDateKey(hour.startsAt, timeZone) === todayKey && hour.uvIndex >= SUNSCREEN_UV_INDEX,
  );
  const first = strongHours[0];
  const last = strongHours.at(-1);
  if (first == null || last == null) {
    return null;
  }
  return { startsAt: first.startsAt, endsAt: fromEpochMs(toEpochMs(last.startsAt) + HOUR_MS) };
}

const NEXT_DAY_HOURS = 24;

function calculateNextDayPrecipitation(
  hourly: readonly HourlyForecastEntry[],
  now: Instant,
): number | null {
  const hours = WeatherReportPolicy.getUpcomingHours(hourly, now).slice(0, NEXT_DAY_HOURS);
  if (hours.length === 0) {
    return null;
  }
  return round(
    sumBy(hours, (hour) => hour.precipitationAmount),
    1,
  );
}

export type NextSunEvent =
  | { kind: 'sunrise'; at: Instant }
  | { kind: 'sunset'; at: Instant }
  | { kind: 'sunriseTomorrow'; at: Instant };

function findNextSunEvent(
  today: Pick<DailyForecastEntry, 'sunrise' | 'sunset'>,
  tomorrow: Pick<DailyForecastEntry, 'sunrise'> | null,
  now: Instant,
): NextSunEvent | null {
  if (today.sunrise != null && toEpochMs(now) < toEpochMs(today.sunrise)) {
    return { kind: 'sunrise', at: today.sunrise };
  }
  if (today.sunset != null && toEpochMs(now) < toEpochMs(today.sunset)) {
    return { kind: 'sunset', at: today.sunset };
  }
  if (tomorrow?.sunrise != null) {
    return { kind: 'sunriseTomorrow', at: tomorrow.sunrise };
  }
  return null;
}

const MINUTES_PER_HOUR = 60;

interface Duration {
  hours: number;
  minutes: number;
}

function findDaylightDuration(
  day: Pick<DailyForecastEntry, 'sunrise' | 'sunset'>,
): Duration | null {
  if (day.sunrise == null || day.sunset == null) {
    return null;
  }
  const totalMinutes = Math.max(
    0,
    Math.round((toEpochMs(day.sunset) - toEpochMs(day.sunrise)) / MINUTE_MS),
  );
  return {
    hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR,
  };
}

function findDayAfter(
  daily: readonly DailyForecastEntry[],
  dateKey: string,
): DailyForecastEntry | null {
  return daily.find((day) => day.date > dateKey) ?? null;
}

function findNextFullMoon(daily: readonly DailyForecastEntry[], dateKey: string): string | null {
  return daily.find((day) => day.date > dateKey && day.moonPhase === 'FULL')?.date ?? null;
}

export const WeatherDetailPolicy = {
  findSunscreenWindow,
  calculateNextDayPrecipitation,
  findNextSunEvent,
  findDaylightDuration,
  findDayAfter,
  findNextFullMoon,
} as const;
