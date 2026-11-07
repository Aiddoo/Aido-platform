import { HOUR_MS } from '@src/shared/constants/time.constants';
import { type Instant, toEpochMs } from '@src/shared/date/instant';

import type { HourlyForecastEntry } from '../schemas/weather-report.schema';
import { isWetHour } from './weather-report.model';

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
      toEpochMs(candidate.startsAt) + HOUR_MS > toEpochMs(now) &&
      toEpochMs(candidate.startsAt) < until &&
      isWetHour(candidate),
  );
  if (hour == null) {
    return null;
  }
  return { hour, isOngoing: toEpochMs(hour.startsAt) <= toEpochMs(now) };
}

export const WeatherNextHourPolicy = {
  getHourlyPrecipitationOutlook,
} as const;
