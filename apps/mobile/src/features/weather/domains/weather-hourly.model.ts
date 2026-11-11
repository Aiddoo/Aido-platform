import type { WeatherCondition, WeatherPrecipitationType } from '@aido/api/vocabulary';
import { type Instant, toDateKey } from '@src/shared/date/instant';
import { countBy, maxBy, minBy, takeWhile } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { HourlyForecastEntry, WeatherReport } from './weather-report.model';
import { WeatherReportPolicy } from './weather-report.model';

/** 요약 문장은 앞으로 하루 안의 강수만 말한다. */
const PRECIPITATION_RANGE_HOURS = 24;
/** 하늘 변화·기온 정점은 반나절 안에서만 찾는다. */
const SKY_RANGE_HOURS = 12;
/** 지금과 1°C도 차이 나지 않으면 오르내린다고 말하지 않는다. */
const MIN_PEAK_DIFFERENCE = 1;

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

/** 강수 확률이 낮은 비·눈 상태 시간은 흐린 하늘로 읽는다. 강수 여부는 확률(WeatherReportPolicy.isWetHour)로만 정한다. */
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

/** 지금 내리는 강수를 상태로 읽는다. 비·눈이 아닌 상태면 null이다. */
function toCurrentPrecipitationType(condition: WeatherCondition): WeatherPrecipitationType | null {
  return match<WeatherCondition, WeatherPrecipitationType | null>(condition)
    .with('DRIZZLE', 'RAIN', 'HEAVY_RAIN', 'THUNDERSTORMS', () => 'RAIN')
    .with('SNOW', 'HEAVY_SNOW', () => 'SNOW')
    .with('SLEET', () => 'SLEET')
    .with('HAIL', () => 'HAIL')
    .with(
      'CLEAR',
      'MOSTLY_CLEAR',
      'PARTLY_CLOUDY',
      'MOSTLY_CLOUDY',
      'CLOUDY',
      'FOGGY',
      'HAZY',
      'WINDY',
      'HOT',
      'FRIGID',
      () => null,
    )
    .exhaustive();
}

function getDominantSky(hours: readonly HourlyForecastEntry[]): HourlySky {
  const counts = countBy(hours, (hour) => toHourlySky(hour.condition));
  return maxBy(HOURLY_SKIES, (sky) => counts[sky] ?? 0) ?? 'clear';
}

/** 낮이면 남은 낮의 최고, 밤이면 남은 밤의 최저 기온을 찾는다. */
function findTemperaturePeak(hours: readonly HourlyForecastEntry[]): TemperaturePeak | null {
  const [first] = hours;
  if (first == null) {
    return null;
  }
  const run = takeWhile(
    hours.slice(0, SKY_RANGE_HOURS),
    (hour) => hour.isDaylight === first.isDaylight,
  );
  const extreme = first.isDaylight ? 'highest' : 'lowest';
  const peak =
    extreme === 'highest'
      ? maxBy(run, (hour) => hour.temperature)
      : minBy(run, (hour) => hour.temperature);
  if (peak == null || Math.abs(peak.temperature - first.temperature) < MIN_PEAK_DIFFERENCE) {
    return null;
  }
  return { extreme, at: peak.startsAt, temperature: peak.temperature };
}

/** 한 시간짜리 깜빡임은 변화로 보지 않고, 두 시간 이상 이어지는 다른 하늘을 찾는다. */
function findSkyChange(hours: readonly HourlyForecastEntry[]) {
  const skies = hours.slice(0, SKY_RANGE_HOURS).map((hour) => toHourlySky(hour.condition));
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

/**
 * 문장은 화면이 i18n 키로 만들고 여기서는 비·눈 → 하늘 변화 → 하늘과 기온 정점 순으로 재료를 고른다.
 * 시간별 카드는 예보 일부만 구독해 Policy 없이 필요한 칸만 받는다
 */
export function getHourlySummary(
  report: Pick<WeatherReport, 'location' | 'hourly' | 'current'>,
  now: Instant,
): HourlySummary | null {
  const hours = WeatherReportPolicy.getUpcomingHours(report.hourly, now).slice(
    0,
    PRECIPITATION_RANGE_HOURS,
  );
  const [first] = hours;
  if (first == null) {
    return null;
  }
  const todayKey = toDateKey(now, report.location.timezone);
  const isLaterDay = (date: Instant) => toDateKey(date, report.location.timezone) !== todayKey;

  // 지금 관측된 강수가 있으면 시간별 확률이 낮아도 '내리는 중'으로 말한다.
  const currentPrecipitation =
    report.current.precipitationIntensity > 0
      ? toCurrentPrecipitationType(report.current.condition)
      : null;
  if (currentPrecipitation != null || WeatherReportPolicy.isWetHour(first)) {
    const dryHour = hours.slice(1).find((hour) => !WeatherReportPolicy.isWetHour(hour));
    return {
      kind: 'precipitationOngoing',
      precipitationType: currentPrecipitation ?? first.precipitationType,
      endsAt: dryHour?.startsAt ?? null,
      isEndingOnLaterDay: dryHour != null && isLaterDay(dryHour.startsAt),
    };
  }

  const wetHour = hours.find(WeatherReportPolicy.isWetHour);
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
    sky: getDominantSky(hours.slice(0, SKY_RANGE_HOURS)),
    peak: findTemperaturePeak(hours),
  };
}
