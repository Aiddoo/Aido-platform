import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time-units';
import { type Instant, fromEpochMs, toEpochMs } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { round, sumBy } from 'es-toolkit';

import type { DailyForecastEntry, HourlyForecastEntry } from './weather-report.model';
import { WeatherReportPolicy } from './weather-report.model';

/** WHO 기준 자외선 지수 3(보통) 이상부터 차단제를 권한다. */
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

/** 지금 시간부터 24시간 동안의 예상 강수량(mm). 시간별 예보가 없으면 null이다. */
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

/** 오늘 아직 지나지 않은 일출·일몰, 둘 다 지났으면 내일 일출. 모두 없으면 null이다. */
function findNextSunEvent(
  today: DailyForecastEntry,
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

function findDaylightDuration(day: DailyForecastEntry): Duration | null {
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

/** 오늘 다음 날짜(YYYY-MM-DD)의 예보. 예보 범위를 넘으면 null이다. */
function findDayAfter(
  daily: readonly DailyForecastEntry[],
  dateKey: string,
): DailyForecastEntry | null {
  return daily.find((day) => day.date > dateKey) ?? null;
}

/** 오늘 뒤로 처음 오는 보름달 날짜(YYYY-MM-DD). 예보 범위(최대 10일) 안에 없으면 null이다. */
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
