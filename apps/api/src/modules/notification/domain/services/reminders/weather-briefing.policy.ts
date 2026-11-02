import {
  WEATHER_BRIEFING_RULES,
  WEATHER_FROZEN_PRECIPITATION_TYPES,
  type WeatherCondition,
  type WeatherPrecipitationType,
} from "@aido/api/vocabulary";
import dayjs from "dayjs";
import { maxBy } from "es-toolkit";

import { TIME_UNIT } from "#api/shared/domain/date/constants/date.constant";
import { addDays } from "#api/shared/domain/date/utils/arithmetic";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { parseDateOnly } from "#api/shared/domain/date/utils/parse";
import { dayWindowInTimezone, resolveTimezone } from "#api/shared/domain/date/utils/timezone";

/**
 * 앱의 아이두 브리핑(`apps/mobile/src/features/weather/domains/weather-briefing.model.ts`)과 같은 규칙으로
 * 날씨 알림 내용을 고른다. 기준값은 `WEATHER_BRIEFING_RULES` 한곳에서 앱과 공유한다.
 * 시간별 예보·할 일 시각은 절대 시각이고, 오늘·내일과 시간대 구분은 알림 시간대(기기 시간대)로,
 * 일별 예보는 위치 시간대의 달력 날짜로 찾는다(앱도 같다).
 */

export interface WeatherBriefingHour {
  readonly startsAt: Date;
  readonly condition: WeatherCondition;
  readonly isDaylight: boolean;
  readonly apparentTemperature: number;
  readonly precipitationChance: number;
  readonly precipitationType: WeatherPrecipitationType;
}

export interface WeatherBriefingDay {
  /** 위치 시간대의 달력 날짜 (YYYY-MM-DD) */
  readonly date: string;
  readonly condition: WeatherCondition;
  readonly temperatureMin: number;
  readonly temperatureMax: number;
  readonly precipitationChance: number;
  readonly precipitationType: WeatherPrecipitationType;
}

export interface WeatherBriefingForecast {
  readonly hourly: readonly WeatherBriefingHour[];
  readonly daily: readonly WeatherBriefingDay[];
}

/** 시각이 정해졌고 아직 하지 않은 오늘 할 일 */
export interface WeatherBriefingTodo {
  readonly id: number;
  readonly title: string;
  readonly scheduledAt: Date;
}

export interface WeatherBriefingClock {
  readonly now: Date;
  /** 알림·할 일 시간대 */
  readonly timezone: string;
  /** 위치(예보) 시간대 */
  readonly locationTimezone: string;
}

export type WetHazard = "rain" | "storm" | "snow";
export type WeatherDayPart = "dawn" | "morning" | "afternoon" | "evening";

export type MorningWeatherBriefing =
  | {
      readonly kind: "todoWet";
      readonly hazard: WetHazard;
      /** 문구에 쓸 할 일. 뇌우면 뇌우와 겹친 첫 할 일, 아니면 가장 이른 할 일 */
      readonly todo: WeatherBriefingTodo;
      readonly todoIds: readonly number[];
      readonly precipitationChance: number;
    }
  | {
      readonly kind: "todoHot";
      readonly todo: WeatherBriefingTodo;
      readonly todoIds: readonly number[];
      /** 그 할 일이 걸린 더운 시간대의 가장 높은 체감 온도 */
      readonly peakApparentTemperature: number;
    }
  | { readonly kind: "wetLater"; readonly startsAt: Date; readonly isSnow: boolean }
  | { readonly kind: "summary"; readonly day: WeatherBriefingDay };

export type EveningWeatherBriefing =
  | {
      readonly kind: "wetTomorrow";
      readonly isSnow: boolean;
      /** 시간별 예보에서 시작 시각을 찾지 못하고 일별 확률로만 알면 null */
      readonly dayPart: WeatherDayPart | null;
      readonly day: WeatherBriefingDay;
      readonly isChilly: boolean;
    }
  | {
      readonly kind: "tomorrowSummary";
      readonly day: WeatherBriefingDay;
      readonly isChilly: boolean;
    };

export function isWetHour(hour: Pick<WeatherBriefingHour, "precipitationChance">): boolean {
  return hour.precipitationChance >= WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE;
}

function isHotHour(hour: WeatherBriefingHour): boolean {
  return (
    hour.isDaylight && hour.apparentTemperature >= WEATHER_BRIEFING_RULES.HOT_APPARENT_TEMPERATURE
  );
}

function isThunderHour(hour: WeatherBriefingHour): boolean {
  return hour.condition === "THUNDERSTORMS";
}

function isFrozen(precipitationType: WeatherPrecipitationType): boolean {
  return WEATHER_FROZEN_PRECIPITATION_TYPES.some((type) => type === precipitationType);
}

function isChilly(day: WeatherBriefingDay): boolean {
  return day.temperatureMin <= WEATHER_BRIEFING_RULES.CHILLY_TEMPERATURE;
}

function findHourIndexAt(hourly: readonly WeatherBriefingHour[], at: Date): number {
  const time = at.getTime();
  return hourly.findIndex(
    (hour) =>
      hour.startsAt.getTime() <= time && time < hour.startsAt.getTime() + TIME_UNIT.MS_PER_HOUR,
  );
}

function nextDateKey(dateKey: string): string {
  return toDateString(addDays(1, parseDateOnly(dateKey)));
}

function toDayPart(instant: Date, timezone: string): WeatherDayPart {
  const hour = dayjs(instant).tz(resolveTimezone(timezone)).hour();
  if (hour < 6) {
    return "dawn";
  }
  if (hour < 12) {
    return "morning";
  }
  return hour < WEATHER_BRIEFING_RULES.EVENING_HOUR ? "afternoon" : "evening";
}

/** 기준 시간에서 앞뒤로 조건이 이어지는 시간 */
function contiguousHours(
  hourly: readonly WeatherBriefingHour[],
  anchor: number,
  isIncluded: (hour: WeatherBriefingHour) => boolean,
): WeatherBriefingHour[] {
  const isRunAt = (index: number) => {
    const hour = hourly[index];
    return hour != null && isIncluded(hour);
  };
  if (!isRunAt(anchor)) {
    return [];
  }
  let first = anchor;
  let last = anchor;
  while (isRunAt(first - 1)) {
    first -= 1;
  }
  while (isRunAt(last + 1)) {
    last += 1;
  }
  return hourly.slice(first, last + 1);
}

interface ForecastTodo {
  readonly todo: WeatherBriefingTodo;
  readonly hour: WeatherBriefingHour;
}

/** 지금 이후 시각의 할 일을 그 시각의 시간별 예보와 묶는다. 예보 범위 밖이면 뺀다. */
function toForecastTodos(
  hourly: readonly WeatherBriefingHour[],
  todos: readonly WeatherBriefingTodo[],
  now: Date,
): ForecastTodo[] {
  const ordered = [...todos].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return ordered.flatMap((todo) => {
    if (todo.scheduledAt.getTime() < now.getTime()) {
      return [];
    }
    const hour = hourly[findHourIndexAt(hourly, todo.scheduledAt)];
    return hour == null ? [] : [{ todo, hour }];
  });
}

function toWetBriefing(wetTodos: readonly ForecastTodo[]): MorningWeatherBriefing | null {
  const [earliest] = wetTodos;
  if (earliest == null) {
    return null;
  }
  const stormy = wetTodos.find(({ hour }) => isThunderHour(hour));
  const hazard: WetHazard =
    stormy != null
      ? "storm"
      : wetTodos.every(({ hour }) => isFrozen(hour.precipitationType))
        ? "snow"
        : "rain";
  const target = stormy ?? earliest;
  return {
    kind: "todoWet",
    hazard,
    todo: target.todo,
    todoIds: wetTodos.map(({ todo }) => todo.id),
    precipitationChance: target.hour.precipitationChance,
  };
}

function toHotBriefing(
  hourly: readonly WeatherBriefingHour[],
  hotTodos: readonly ForecastTodo[],
): MorningWeatherBriefing | null {
  const [earliest] = hotTodos;
  if (earliest == null) {
    return null;
  }
  const hotRun = contiguousHours(
    hourly,
    findHourIndexAt(hourly, earliest.hour.startsAt),
    isHotHour,
  );
  const peak = maxBy(hotRun, (hour) => hour.apparentTemperature) ?? earliest.hour;
  return {
    kind: "todoHot",
    todo: earliest.todo,
    todoIds: hotTodos.map(({ todo }) => todo.id),
    peakApparentTemperature: peak.apparentTemperature,
  };
}

/** 지금 시간부터 오늘(알림 시간대) 안에 처음 비·눈이 오는 시간 */
function toWetLaterBriefing(
  hourly: readonly WeatherBriefingHour[],
  { now, timezone }: WeatherBriefingClock,
): MorningWeatherBriefing | null {
  const todayKey = dayWindowInTimezone(now, timezone).localDate;
  const wetHour = hourly.find(
    (hour) =>
      hour.startsAt.getTime() + TIME_UNIT.MS_PER_HOUR > now.getTime() &&
      dayWindowInTimezone(hour.startsAt, timezone).localDate === todayKey &&
      isWetHour(hour),
  );
  if (wetHour == null) {
    return null;
  }
  const startsAt = wetHour.startsAt.getTime() < now.getTime() ? now : wetHour.startsAt;
  return { kind: "wetLater", startsAt, isSnow: isFrozen(wetHour.precipitationType) };
}

/**
 * 아침 알림: 할 일과 겹친 비·뇌우·눈 → 할 일과 겹친 더위 → 오늘 늦게 오는 비 → 오늘 요약 순.
 * 위치 시간대의 오늘 일별 예보가 없으면 판단하지 않는다(null).
 */
export function decideMorningWeatherBriefing(
  forecast: WeatherBriefingForecast,
  todos: readonly WeatherBriefingTodo[],
  clock: WeatherBriefingClock,
): MorningWeatherBriefing | null {
  const today = forecast.daily.find(
    (day) => day.date === dayWindowInTimezone(clock.now, clock.locationTimezone).localDate,
  );
  if (today == null) {
    return null;
  }
  const forecastTodos = toForecastTodos(forecast.hourly, todos, clock.now);
  return (
    toWetBriefing(forecastTodos.filter(({ hour }) => isWetHour(hour))) ??
    toHotBriefing(
      forecast.hourly,
      forecastTodos.filter(({ hour }) => isHotHour(hour)),
    ) ??
    toWetLaterBriefing(forecast.hourly, clock) ?? { kind: "summary", day: today }
  );
}

/**
 * 저녁 알림: 내일(알림 시간대) 비·눈이 시작하는 때와 쌀쌀함을, 없으면 내일 요약을 알린다.
 * 위치 시간대의 내일 일별 예보가 없으면 판단하지 않는다(null).
 */
export function decideEveningWeatherBriefing(
  forecast: WeatherBriefingForecast,
  clock: WeatherBriefingClock,
): EveningWeatherBriefing | null {
  const tomorrowKey = nextDateKey(dayWindowInTimezone(clock.now, clock.locationTimezone).localDate);
  const tomorrow = forecast.daily.find((day) => day.date === tomorrowKey);
  if (tomorrow == null) {
    return null;
  }
  const deviceTomorrowKey = nextDateKey(dayWindowInTimezone(clock.now, clock.timezone).localDate);
  const wetHour = forecast.hourly.find(
    (hour) =>
      dayWindowInTimezone(hour.startsAt, clock.timezone).localDate === deviceTomorrowKey &&
      isWetHour(hour),
  );
  if (wetHour != null) {
    return {
      kind: "wetTomorrow",
      isSnow: isFrozen(wetHour.precipitationType),
      dayPart: toDayPart(wetHour.startsAt, clock.timezone),
      day: tomorrow,
      isChilly: isChilly(tomorrow),
    };
  }
  if (isWetHour(tomorrow)) {
    return {
      kind: "wetTomorrow",
      isSnow: isFrozen(tomorrow.precipitationType),
      dayPart: null,
      day: tomorrow,
      isChilly: isChilly(tomorrow),
    };
  }
  return { kind: "tomorrowSummary", day: tomorrow, isChilly: isChilly(tomorrow) };
}
