import { HOUR_MS } from '@src/shared/constants/time-units';
import { type Instant, toEpochMs } from '@src/shared/date/instant';
import { orderBy } from 'es-toolkit';

import { WeatherReportPolicy } from '../domains/weather-report.model';
import type { HourlyForecastEntry, WeatherReport } from '../schemas/weather-report.schema';

export type HourlyTimelineItem =
  | { kind: 'hour'; hour: HourlyForecastEntry; isNow: boolean }
  | { kind: 'sunrise' | 'sunset'; at: Instant };

function getTimelineTime(item: HourlyTimelineItem): number {
  return item.kind === 'hour' ? toEpochMs(item.hour.startsAt) : toEpochMs(item.at);
}

/** 남은 시간별 예보 사이에 그 범위 안의 일출·일몰 칸을 시각 순서로 끼워 넣는다. */
export function toHourlyTimeline(
  report: Pick<WeatherReport, 'hourly' | 'daily'>,
  now: Instant,
): HourlyTimelineItem[] {
  const hours = WeatherReportPolicy.getUpcomingHours(report.hourly, now);
  const last = hours.at(-1);
  if (last == null) {
    return [];
  }
  const rangeEnd = toEpochMs(last.startsAt) + HOUR_MS;
  const isInRange = (date: Instant) =>
    toEpochMs(date) > toEpochMs(now) && toEpochMs(date) < rangeEnd;

  const hourItems = hours.map((hour, index): HourlyTimelineItem => ({
    kind: 'hour',
    hour,
    isNow: index === 0,
  }));
  const sunItems = report.daily.flatMap((day): HourlyTimelineItem[] => [
    ...(day.sunrise != null && isInRange(day.sunrise)
      ? [{ kind: 'sunrise' as const, at: day.sunrise }]
      : []),
    ...(day.sunset != null && isInRange(day.sunset)
      ? [{ kind: 'sunset' as const, at: day.sunset }]
      : []),
  ]);
  return orderBy([...hourItems, ...sunItems], [getTimelineTime], ['asc']);
}
