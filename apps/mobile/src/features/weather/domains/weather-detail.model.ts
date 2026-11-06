import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time.constants';
import { toDateKey } from '@src/shared/date/instant';
import { round, sumBy } from 'es-toolkit';

import {
  type AirPollutant,
  type AirQuality,
  type DailyForecastEntry,
  type HourlyForecastEntry,
  selectUpcomingHours,
} from './weather-report.model';

function pickPollutant(
  airQuality: Pick<AirQuality, 'pm10' | 'pm25'>,
  pollutant: AirPollutant,
): Pick<AirQuality, 'pm10' | 'pm25'> {
  return pollutant === 'pm10'
    ? { pm10: airQuality.pm10, pm25: null }
    : { pm10: null, pm25: airQuality.pm25 };
}

export type VisibilityLevel = 'clear' | 'moderate' | 'poor';

const METERS_PER_KILOMETER = 1000;

function getVisibilityLevel(meters: number): VisibilityLevel {
  const kilometers = meters / METERS_PER_KILOMETER;
  if (kilometers >= 10) {
    return 'clear';
  }
  return kilometers >= 5 ? 'moderate' : 'poor';
}

export type CloudCoverLevel = 'overcast' | 'mostlyCloudy' | 'mostlyClear';

function getCloudCoverLevel(cloudCover: number): CloudCoverLevel {
  if (cloudCover >= 80) {
    return 'overcast';
  }
  return cloudCover >= 40 ? 'mostlyCloudy' : 'mostlyClear';
}

/** 상대 습도가 이 값(%) 이상이면 눅눅하다고 안내한다. */
const MUGGY_HUMIDITY = 80;

function isMuggy(humidity: number): boolean {
  return humidity >= MUGGY_HUMIDITY;
}

/** WHO 기준 자외선 지수 3(보통) 이상부터 차단제를 권한다. */
const SUNSCREEN_UV_INDEX = 3;

interface TimeWindow {
  startsAt: Date;
  endsAt: Date;
}

/** 오늘(위치 시간대) 남은 시간 중 자외선 차단이 필요한 첫 시각~마지막 시각. 없으면 null이다. */
function getSunscreenWindow(
  hourly: readonly HourlyForecastEntry[],
  now: Date,
  timeZone: string,
): TimeWindow | null {
  const todayKey = toDateKey(now, timeZone);
  const strongHours = selectUpcomingHours(hourly, now).filter(
    (hour) => toDateKey(hour.startsAt, timeZone) === todayKey && hour.uvIndex >= SUNSCREEN_UV_INDEX,
  );
  const first = strongHours[0];
  const last = strongHours.at(-1);
  if (first == null || last == null) {
    return null;
  }
  return { startsAt: first.startsAt, endsAt: new Date(last.startsAt.getTime() + HOUR_MS) };
}

const NEXT_DAY_HOURS = 24;

/** 지금 시간부터 24시간 동안의 예상 강수량(mm). 시간별 예보가 없으면 null이다. */
function sumNextDayPrecipitation(hourly: readonly HourlyForecastEntry[], now: Date): number | null {
  const hours = selectUpcomingHours(hourly, now).slice(0, NEXT_DAY_HOURS);
  if (hours.length === 0) {
    return null;
  }
  return round(
    sumBy(hours, (hour) => hour.precipitationAmount),
    1,
  );
}

export type NextSunEvent =
  | { kind: 'sunrise'; at: Date }
  | { kind: 'sunset'; at: Date }
  | { kind: 'sunriseTomorrow'; at: Date };

/** 오늘 아직 지나지 않은 일출·일몰, 둘 다 지났으면 내일 일출. 모두 없으면 null이다. */
function getNextSunEvent(
  today: Pick<DailyForecastEntry, 'sunrise' | 'sunset'>,
  tomorrow: Pick<DailyForecastEntry, 'sunrise'> | null,
  now: Date,
): NextSunEvent | null {
  if (today.sunrise != null && now.getTime() < today.sunrise.getTime()) {
    return { kind: 'sunrise', at: today.sunrise };
  }
  if (today.sunset != null && now.getTime() < today.sunset.getTime()) {
    return { kind: 'sunset', at: today.sunset };
  }
  if (tomorrow?.sunrise != null) {
    return { kind: 'sunriseTomorrow', at: tomorrow.sunrise };
  }
  return null;
}

interface Duration {
  hours: number;
  minutes: number;
}

function getDaylightDuration(day: Pick<DailyForecastEntry, 'sunrise' | 'sunset'>): Duration | null {
  if (day.sunrise == null || day.sunset == null) {
    return null;
  }
  const totalMinutes = Math.max(
    0,
    Math.round((day.sunset.getTime() - day.sunrise.getTime()) / MINUTE_MS),
  );
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
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

export type WindLevel = 'calm' | 'breeze' | 'strong';

/** 보퍼트 풍력 1(실바람) 미만은 잔잔, 4(건들바람) 이상은 강하다고 본다. */
const CALM_WIND_MPS = 1.5;
const STRONG_WIND_MPS = 5.5;

function getWindLevel(windSpeed: number): WindLevel {
  if (windSpeed < CALM_WIND_MPS) {
    return 'calm';
  }
  return windSpeed < STRONG_WIND_MPS ? 'breeze' : 'strong';
}

export const WeatherDetailPolicy = {
  pickPollutant,
  getVisibilityLevel,
  getCloudCoverLevel,
  isMuggy,
  getSunscreenWindow,
  sumNextDayPrecipitation,
  getNextSunEvent,
  getDaylightDuration,
  findDayAfter,
  findNextFullMoon,
  getWindLevel,
} as const;
