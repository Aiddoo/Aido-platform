import { formatDateKey, getZonedHour } from '@src/shared/utils/date-format';

/** 기상청 예보 시각은 한국 표준시 기준이다. */
const KMA_TIME_ZONE = 'Asia/Seoul';

export interface WeatherClock {
  date: string;
  hour: number;
  deviceHour: number;
}

export function createWeatherClock(now: Date): WeatherClock {
  return {
    date: formatDateKey(now, KMA_TIME_ZONE),
    hour: getZonedHour(now, KMA_TIME_ZONE),
    deviceHour: now.getHours(),
  };
}
