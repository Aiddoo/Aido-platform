import { HOUR_MS } from '@src/shared/constants/time.constants';

import { type HourlyForecastEntry, isWetHour } from './weather-report.model';

/** 분 단위 예보가 없는 지역은 이 시간 안의 시간별 예보로만 곧 올 비를 알린다. */
const HOURLY_OUTLOOK_RANGE_HOURS = 6;

export interface HourlyPrecipitationOutlook {
  hour: HourlyForecastEntry;
  isOngoing: boolean;
}

/** 지금 시간부터 6시간 안에서 비가 오는 첫 시간을 고른다. 없으면 빈 카드를 만들지 않도록 null이다. */
function getHourlyPrecipitationOutlook(
  hourly: readonly HourlyForecastEntry[],
  now: Date,
): HourlyPrecipitationOutlook | null {
  const until = now.getTime() + HOURLY_OUTLOOK_RANGE_HOURS * HOUR_MS;
  const hour = hourly.find(
    (candidate) =>
      candidate.startsAt.getTime() + HOUR_MS > now.getTime() &&
      candidate.startsAt.getTime() < until &&
      isWetHour(candidate),
  );
  if (hour == null) {
    return null;
  }
  return { hour, isOngoing: hour.startsAt.getTime() <= now.getTime() };
}

export const WeatherNextHourPolicy = {
  getHourlyPrecipitationOutlook,
} as const;
