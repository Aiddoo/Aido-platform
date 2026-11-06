import { HOUR_MS } from '@src/shared/constants/time.constants';
import { orderBy } from 'es-toolkit';

import {
  type HourlyForecastEntry,
  WeatherReportPolicy,
  type WeatherReport,
} from '../domains/weather-report.model';

export type HourlyTimelineItem =
  | { kind: 'hour'; hour: HourlyForecastEntry; isNow: boolean }
  | { kind: 'sunrise' | 'sunset'; at: Date };

function getTimelineTime(item: HourlyTimelineItem): number {
  return item.kind === 'hour' ? item.hour.startsAt.getTime() : item.at.getTime();
}

/** 남은 시간별 예보 사이에 그 범위 안의 일출·일몰 칸을 시각 순서로 끼워 넣는다. */
export function toHourlyTimeline(
  report: Pick<WeatherReport, 'hourly' | 'daily'>,
  now: Date,
): HourlyTimelineItem[] {
  const hours = WeatherReportPolicy.selectUpcomingHours(report.hourly, now);
  const last = hours.at(-1);
  if (last == null) {
    return [];
  }
  const rangeEnd = last.startsAt.getTime() + HOUR_MS;
  const isInRange = (date: Date) => date.getTime() > now.getTime() && date.getTime() < rangeEnd;

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
