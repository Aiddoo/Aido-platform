import {
  WEATHER_BRIEFING_RULES,
  WEATHER_CONDITIONS,
  WEATHER_FROZEN_PRECIPITATION_TYPES,
  WEATHER_PRECIPITATION_TYPES,
  type WeatherCondition,
  type WeatherPrecipitationType,
} from '@aido/api/vocabulary';
import { HOUR_MS } from '@src/shared/constants/time-units';
import type { DateKey } from '@src/shared/date/date-key';
import { type Instant, fromEpochMs, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { maxBy, minBy, round, sumBy, takeWhile } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

/** 한 시간 칸의 예보. startsAt부터 한 시간이다 */
export const forecastHourSchema = z.object({
  startsAt: instantSchema,
  condition: z.enum(WEATHER_CONDITIONS),
  isDaylight: z.boolean(),
  temperature: z.number(),
  apparentTemperature: z.number(),
  uvIndex: z.number(),
  precipitationChance: z.number(),
  precipitationAmount: z.number(),
  precipitationType: z.enum(WEATHER_PRECIPITATION_TYPES),
});
export type ForecastHour = z.infer<typeof forecastHourSchema>;

/**
 * 이 확률(%) 이상이면 비가 오는 시간으로 본다. 서버 날씨 알림·브리핑과 같은 기준이다.
 * 확률 숫자를 칸에 적는 기준(`LABELED_PRECIPITATION_CHANCE_MIN_PERCENT`, 20%)과는 뜻이 다른 값이다
 */
const WET_HOUR_CHANCE_PERCENT = WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE;
/** WHO 기준 자외선 지수 3(보통) 이상부터 차단제를 권한다. */
const SUNSCREEN_UV_INDEX = 3;
const NEXT_DAY_HOURS = 24;
/** 분 단위 예보가 없는 지역은 이 시간 안의 시간별 예보로만 곧 올 비를 알린다. */
const PRECIPITATION_OUTLOOK_RANGE_HOURS = 6;
/** 요약 문장은 앞으로 하루 안의 강수만 말한다. */
const SUMMARY_PRECIPITATION_RANGE_HOURS = 24;
/** 하늘 변화·기온 정점은 반나절 안에서만 찾는다. */
const SUMMARY_SKY_RANGE_HOURS = 12;
/** 지금과 1°C도 차이 나지 않으면 오르내린다고 말하지 않는다. */
const MIN_PEAK_DIFFERENCE_CELSIUS = 1;

const OVERCAST_CONDITIONS: ReadonlySet<WeatherCondition> = new Set([
  'CLOUDY',
  'MOSTLY_CLOUDY',
  'FOGGY',
  'HAZY',
]);

const HOURLY_SKIES = ['clear', 'partlyCloudy', 'cloudy', 'hazy'] as const;
export type HourlySky = (typeof HOURLY_SKIES)[number];

interface TemperaturePeak {
  extreme: 'highest' | 'lowest';
  at: Instant;
  temperature: number;
}

export type HourlySummary =
  | {
      kind: 'precipitationOngoing';
      precipitationType: WeatherPrecipitationType;
      endsAt: Instant | null;
      isEndingOnLaterDay: boolean;
    }
  | {
      kind: 'precipitationUpcoming';
      precipitationType: WeatherPrecipitationType;
      startsAt: Instant;
      isStartingOnLaterDay: boolean;
      skyBefore: HourlySky;
    }
  | {
      kind: 'skyChange';
      from: HourlySky;
      to: HourlySky;
      changesAt: Instant;
      isChangingOnLaterDay: boolean;
    }
  | { kind: 'steady'; sky: HourlySky; peak: TemperaturePeak | null };

export interface HourlyPrecipitationOutlook {
  hour: ForecastHour;
  isOngoing: boolean;
}

export interface HourRange {
  startsAt: Instant;
  endsAt: Instant;
}

/** 요약이 예보 밖에서 받는 값. 날짜는 예보 위치 시간대로 가르고, 지금 관측된 강수는 시간별 확률보다 먼저다 */
interface HourlySummaryContext {
  now: Instant;
  timezone: string;
  observedPrecipitationType: WeatherPrecipitationType | null;
}

export function isFrozenPrecipitation(precipitationType: WeatherPrecipitationType): boolean {
  return WEATHER_FROZEN_PRECIPITATION_TYPES.some((frozen) => frozen === precipitationType);
}

/**
 * 그 시간대의 그 날짜에 시작하는 시간인가. 어느 시간대의 오늘로 거를지는 부르는 쪽이 정한다:
 * 자외선 차단 시간은 예보 위치, 옮기기 시트의 강수 막대는 기기 시간대다
 */
export function filterByLocalDate(hour: ForecastHour, dateKey: DateKey, timezone: string): boolean {
  return toDateKey(hour.startsAt, timezone) === dateKey;
}

function getEndsAtMs(hour: ForecastHour): number {
  return toEpochMs(hour.startsAt) + HOUR_MS;
}

/** 강수 확률이 낮은 비·눈 상태 시간은 흐린 하늘로 읽는다. 강수 여부는 확률(ForecastHourPolicy.isWet)로만 정한다. */
function toHourlySky(condition: WeatherCondition): HourlySky {
  return match<WeatherCondition, HourlySky>(condition)
    .with('CLEAR', 'MOSTLY_CLEAR', 'HOT', () => 'clear')
    .with('PARTLY_CLOUDY', 'MOSTLY_CLOUDY', () => 'partlyCloudy')
    .with('FOGGY', 'HAZY', () => 'hazy')
    .with(
      'CLOUDY',
      'WINDY',
      'FRIGID',
      'DRIZZLE',
      'RAIN',
      'HEAVY_RAIN',
      'THUNDERSTORMS',
      'SLEET',
      'SNOW',
      'HEAVY_SNOW',
      'HAIL',
      () => 'cloudy',
    )
    .exhaustive();
}

/** 가장 많은 시간을 차지한 하늘. 시간 수가 같거나 시간이 없으면 HOURLY_SKIES의 앞 하늘(맑음부터)이다 */
function getDominantSky(hours: readonly ForecastHour[]): HourlySky {
  const skies = hours.map((hour) => toHourlySky(hour.condition));
  return maxBy(HOURLY_SKIES, (sky) => skies.filter((candidate) => candidate === sky).length);
}

/** 낮이면 남은 낮의 최고, 밤이면 남은 밤의 최저 기온을 찾는다. */
function findTemperaturePeak(hours: readonly ForecastHour[]): TemperaturePeak | null {
  const [first] = hours;
  if (first == null) {
    return null;
  }
  const run = takeWhile(
    hours.slice(0, SUMMARY_SKY_RANGE_HOURS),
    (hour) => hour.isDaylight === first.isDaylight,
  );
  const extreme = first.isDaylight ? 'highest' : 'lowest';
  const peak =
    extreme === 'highest'
      ? maxBy(run, (hour) => hour.temperature)
      : minBy(run, (hour) => hour.temperature);
  if (
    peak == null ||
    Math.abs(peak.temperature - first.temperature) < MIN_PEAK_DIFFERENCE_CELSIUS
  ) {
    return null;
  }
  return { extreme, at: peak.startsAt, temperature: peak.temperature };
}

/** 한 시간짜리 깜빡임은 변화로 보지 않고, 두 시간 이상 이어지는 다른 하늘을 찾는다. */
function findSkyChange(hours: readonly ForecastHour[]) {
  const skies = hours.slice(0, SUMMARY_SKY_RANGE_HOURS).map((hour) => toHourlySky(hour.condition));
  const [from] = skies;
  const index = skies.findIndex(
    (sky, position) => position > 0 && sky !== from && skies[position + 1] === sky,
  );
  const hour = hours[index];
  const to = skies[index];
  if (from == null || index <= 0 || hour == null || to == null) {
    return null;
  }
  return { from, to, changesAt: hour.startsAt };
}

export const ForecastHourPolicy = {
  isWet(hour: ForecastHour) {
    return WET_HOUR_CHANCE_PERCENT <= hour.precipitationChance;
  },

  isOvercast(hour: ForecastHour) {
    return OVERCAST_CONDITIONS.has(hour.condition);
  },

  getEndsAt(hour: ForecastHour) {
    return fromEpochMs(getEndsAtMs(hour));
  },

  /** 지금이 속한 시간부터 남기고 이미 끝난 시간은 뺀다 */
  getUpcoming(hourly: readonly ForecastHour[], now: Instant) {
    return hourly.filter((hour) => toEpochMs(now) < getEndsAtMs(hour));
  },

  /** 그 순간을 담은 시간. 예보 범위 밖이면 null이다 */
  findAt(hourly: readonly ForecastHour[], at: Instant) {
    const time = toEpochMs(at);
    return (
      hourly.find((hour) => toEpochMs(hour.startsAt) <= time && time < getEndsAtMs(hour)) ?? null
    );
  },

  /** 그 순간 뒤에 끝나는 첫 비 오는 시간 */
  findFirstWetEndingAfter(hourly: readonly ForecastHour[], after: Instant): ForecastHour | null {
    return hourly.find((hour) => toEpochMs(after) < getEndsAtMs(hour) && this.isWet(hour)) ?? null;
  },

  /** 그 순간부터 처음 비가 그치는 시간의 시작. 예보 끝까지 비가 오면 null이다 */
  findFirstDryStartFrom(hourly: readonly ForecastHour[], from: Instant): Instant | null {
    const dryHour = hourly.find(
      (hour) => toEpochMs(from) <= toEpochMs(hour.startsAt) && !this.isWet(hour),
    );
    return dryHour?.startsAt ?? null;
  },

  /** 범위 안에서 지금 이후 첫 시간의 시작. 30분 단위 범위도 예보 칸에 맞는다. 모두 지났으면 null이다 */
  findFirstStartWithin(hourly: readonly ForecastHour[], range: HourRange, now: Instant) {
    const next = hourly.find(
      (hour) =>
        toEpochMs(now) <= toEpochMs(hour.startsAt) &&
        toEpochMs(range.startsAt) <= toEpochMs(hour.startsAt) &&
        toEpochMs(hour.startsAt) < toEpochMs(range.endsAt),
    );
    return next?.startsAt ?? null;
  },

  /** 지금 시간부터 6시간 안에서 비가 오는 첫 시간을 고른다. 없으면 빈 카드를 만들지 않도록 null이다. */
  findPrecipitationOutlook(
    hourly: readonly ForecastHour[],
    now: Instant,
  ): HourlyPrecipitationOutlook | null {
    const until = toEpochMs(now) + PRECIPITATION_OUTLOOK_RANGE_HOURS * HOUR_MS;
    const hour = hourly.find(
      (candidate) =>
        toEpochMs(now) < getEndsAtMs(candidate) &&
        toEpochMs(candidate.startsAt) < until &&
        this.isWet(candidate),
    );
    if (hour == null) {
      return null;
    }
    return { hour, isOngoing: toEpochMs(hour.startsAt) <= toEpochMs(now) };
  },

  /** 그 날짜(그 시간대)의 남은 시간 중 자외선 차단이 필요한 첫 시각~마지막 시각. 없으면 null이다. */
  findSunscreenWindow(
    hourly: readonly ForecastHour[],
    now: Instant,
    timezone: string,
  ): HourRange | null {
    const todayKey = toDateKey(now, timezone);
    const strongHours = this.getUpcoming(hourly, now).filter(
      (hour) => filterByLocalDate(hour, todayKey, timezone) && SUNSCREEN_UV_INDEX <= hour.uvIndex,
    );
    const first = strongHours[0];
    const last = strongHours.at(-1);
    if (first == null || last == null) {
      return null;
    }
    return { startsAt: first.startsAt, endsAt: fromEpochMs(getEndsAtMs(last)) };
  },

  /** 지금 시간부터 24시간 동안의 예상 강수량(mm). 시간별 예보가 없으면 null이다. */
  calculateNextDayPrecipitation(hourly: readonly ForecastHour[], now: Instant): number | null {
    const hours = this.getUpcoming(hourly, now).slice(0, NEXT_DAY_HOURS);
    if (hours.length === 0) {
      return null;
    }
    return round(
      sumBy(hours, (hour) => hour.precipitationAmount),
      1,
    );
  },

  /** 문장은 화면이 i18n 키로 만들고 여기서는 비·눈 → 하늘 변화 → 하늘과 기온 정점 순으로 재료를 고른다 */
  findSummary(
    hourly: readonly ForecastHour[],
    { now, timezone, observedPrecipitationType }: HourlySummaryContext,
  ): HourlySummary | null {
    const hours = this.getUpcoming(hourly, now).slice(0, SUMMARY_PRECIPITATION_RANGE_HOURS);
    const [first] = hours;
    if (first == null) {
      return null;
    }
    const todayKey = toDateKey(now, timezone);
    const isLaterDay = (date: Instant) => toDateKey(date, timezone) !== todayKey;

    // 지금 관측된 강수가 있으면 시간별 확률이 낮아도 '내리는 중'으로 말한다.
    if (observedPrecipitationType != null || this.isWet(first)) {
      const dryHour = hours.slice(1).find((hour) => !this.isWet(hour));
      return {
        kind: 'precipitationOngoing',
        precipitationType: observedPrecipitationType ?? first.precipitationType,
        endsAt: dryHour?.startsAt ?? null,
        isEndingOnLaterDay: dryHour != null && isLaterDay(dryHour.startsAt),
      };
    }

    const wetHour = hours.find((hour) => this.isWet(hour));
    if (wetHour != null) {
      return {
        kind: 'precipitationUpcoming',
        precipitationType: wetHour.precipitationType,
        startsAt: wetHour.startsAt,
        isStartingOnLaterDay: isLaterDay(wetHour.startsAt),
        skyBefore: getDominantSky(hours.slice(0, hours.indexOf(wetHour))),
      };
    }

    const change = findSkyChange(hours);
    if (change != null) {
      return { kind: 'skyChange', ...change, isChangingOnLaterDay: isLaterDay(change.changesAt) };
    }

    return {
      kind: 'steady',
      sky: getDominantSky(hours.slice(0, SUMMARY_SKY_RANGE_HOURS)),
      peak: findTemperaturePeak(hours),
    };
  },
};
