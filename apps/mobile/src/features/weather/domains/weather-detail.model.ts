import { HOUR_MS, MINUTE_MS } from '@src/shared/constants/time.constants';
import { toDateKey } from '@src/shared/date/instant';
import { clamp, round, sumBy } from 'es-toolkit';
import { match } from 'ts-pattern';

import {
  type AirQuality,
  type DailyForecastEntry,
  type HourlyForecastEntry,
  PM10_UPPER_BOUNDS,
  PM25_UPPER_BOUNDS,
  selectUpcomingHours,
} from './weather-report.model';

/** 막대 끝에 점이 반쯤 잘리지 않도록 3%~97% 안에 둔다. */
const METER_MIN = 0.03;
const METER_MAX = 0.97;
/** 자외선 막대는 0~11+(위험)까지를 한 줄로 그린다. */
const UV_METER_MAX = 11;

function toUvMeterPosition(uvIndex: number): number {
  return clamp(uvIndex / UV_METER_MAX, METER_MIN, METER_MAX);
}

export type AirPollutant = 'pm10' | 'pm25';

/** 막대를 등급 4칸으로 똑같이 나누고, 매우 나쁨 칸은 마지막 기준의 두 배까지 펼친다. */
const AIR_METER_BOUNDS = {
  pm10: [0, ...PM10_UPPER_BOUNDS, PM10_UPPER_BOUNDS[2] * 2],
  pm25: [0, ...PM25_UPPER_BOUNDS, PM25_UPPER_BOUNDS[2] * 2],
} as const satisfies Record<AirPollutant, readonly number[]>;

function toAirMeterPosition(value: number, pollutant: AirPollutant): number {
  const bounds = AIR_METER_BOUNDS[pollutant];
  const segmentCount = bounds.length - 1;
  const upperIndex = bounds.findIndex((bound, position) => position > 0 && value <= bound);
  const index = upperIndex === -1 ? segmentCount - 1 : upperIndex - 1;
  const lower = bounds[index] ?? 0;
  const upper = bounds[index + 1] ?? lower;
  const withinSegment = value > upper ? 1 : (value - lower) / Math.max(upper - lower, 1);
  return clamp((index + withinSegment) / segmentCount, METER_MIN, METER_MAX);
}

export function pickPollutant(
  airQuality: Pick<AirQuality, 'pm10' | 'pm25'>,
  pollutant: AirPollutant,
): Pick<AirQuality, 'pm10' | 'pm25'> {
  return pollutant === 'pm10'
    ? { pm10: airQuality.pm10, pm25: null }
    : { pm10: null, pm25: airQuality.pm25 };
}

export type VisibilityLevel = 'clear' | 'moderate' | 'poor';

const METERS_PER_KILOMETER = 1000;
/** 10km 미만은 소수 한 자리까지 보여 줘야 1.2km 같은 짙은 안개가 0km로 뭉개지지 않는다. */
const VISIBILITY_DECIMAL_BELOW_KM = 10;

function toVisibilityKilometers(meters: number): number {
  const kilometers = meters / METERS_PER_KILOMETER;
  return kilometers < VISIBILITY_DECIMAL_BELOW_KM ? round(kilometers, 1) : Math.round(kilometers);
}

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

export function isMuggy(humidity: number): boolean {
  return humidity >= MUGGY_HUMIDITY;
}

/** WHO 기준 자외선 지수 3(보통) 이상부터 차단제를 권한다. */
const SUNSCREEN_UV_INDEX = 3;

export interface TimeWindow {
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

export interface Duration {
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

export type CloudCoverNote = 'overcast' | 'brokenDay' | 'brokenNight' | 'clearDay' | 'clearNight';

function getCloudCoverNote(cloudCover: number, isDaylight: boolean): CloudCoverNote {
  return match<CloudCoverLevel, CloudCoverNote>(getCloudCoverLevel(cloudCover))
    .with('overcast', () => 'overcast')
    .with('mostlyCloudy', () => (isDaylight ? 'brokenDay' : 'brokenNight'))
    .with('mostlyClear', () => (isDaylight ? 'clearDay' : 'clearNight'))
    .exhaustive();
}

export const WeatherDetailPolicy = {
  uvMeterPosition: toUvMeterPosition,
  airMeterPosition: toAirMeterPosition,
  pickPollutant,
  visibilityKilometers: toVisibilityKilometers,
  visibilityLevel: getVisibilityLevel,
  cloudCoverLevel: getCloudCoverLevel,
  isMuggy,
  sunscreenWindow: getSunscreenWindow,
  nextDayPrecipitation: sumNextDayPrecipitation,
  nextSunEvent: getNextSunEvent,
  daylightDuration: getDaylightDuration,
  dayAfter: findDayAfter,
  nextFullMoon: findNextFullMoon,
  windLevel: getWindLevel,
  cloudCoverNote: getCloudCoverNote,
} as const;
