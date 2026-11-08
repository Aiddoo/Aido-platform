import type { WeatherCondition, WeatherPrecipitationType } from '@aido/api/vocabulary';
import { type Instant, toDateKey } from '@src/shared/date/instant';
import { countBy, maxBy, minBy, takeWhile } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { HourlyForecastEntry, WeatherReport } from './weather-report.model';
import { WeatherReportPolicy } from './weather-report.model';

const PRECIPITATION_RANGE_HOURS = 24;
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

function getHourlySummary(
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

export const WeatherHourlyPolicy = {
  getHourlySummary,
} as const;
