import {
  WEATHER_BRIEFING_RULES,
  WEATHER_FROZEN_PRECIPITATION_TYPES,
  type WeatherDayPart,
  type WeatherPrecipitationType,
  type WeatherWetHazard,
} from "@aido/api/vocabulary";
import { maxBy } from "es-toolkit";

import { localDateIn, resolveTimezone } from "#api/shared/domain/time/timezone-name";

import {
  findContiguousHours,
  findHourIndexAt,
  type ForecastTodo,
  isHotHour,
  isWetHour,
  planWeatherBriefing,
  type WeatherBriefingTodo,
} from "./weather-briefing.domain-service.js";
import type { WeatherReportDay, WeatherReportHour } from "./weather-report.aggregate.js";

/**
 * 아침·저녁 날씨 알림에 담을 내용을 고른다. 할 일과 겹친 날씨는 날씨 화면 브리핑과 같은 planWeatherBriefing이 정한다.
 * 시간별 예보·할 일 시각은 절대 시각이고, 오늘·내일과 시간대 구분은 알림 시간대(기기 시간대)로,
 * 일별 예보는 위치 시간대의 달력 날짜로 찾는다.
 */

export type WeatherBriefingReportHour = Pick<
  WeatherReportHour,
  | "startsAt"
  | "condition"
  | "isDaylight"
  | "apparentTemperature"
  | "precipitationChance"
  | "precipitationType"
>;

export type WeatherBriefingDay = Pick<
  WeatherReportDay,
  | "date"
  | "condition"
  | "temperatureMin"
  | "temperatureMax"
  | "precipitationChance"
  | "precipitationType"
>;

export interface WeatherBriefingForecast {
  readonly hourly: readonly WeatherBriefingReportHour[];
  readonly daily: readonly WeatherBriefingDay[];
}

/** 시각이 정해졌고 아직 하지 않은 오늘 할 일. 알림 문구에 제목을 쓴다 */
export interface TitledWeatherBriefingTodo extends WeatherBriefingTodo {
  readonly title: string;
}

export interface WeatherBriefingClock {
  readonly now: Temporal.Instant;
  /** 알림·할 일 시간대 */
  readonly timezone: string;
  /** 위치(예보) 시간대 */
  readonly locationTimezone: string;
}

/** 할 일과 겹친 날씨와 오늘 늦게 오는 비·눈. 아침 알림과 날씨 화면 머리글이 함께 쓴다 */
export type TodayWeatherBriefing<TTodo extends WeatherBriefingTodo = TitledWeatherBriefingTodo> =
  | {
      readonly kind: "todoWet";
      readonly hazard: WeatherWetHazard;
      /** 문구에 쓸 할 일. 뇌우면 뇌우와 겹친 첫 할 일, 아니면 가장 이른 할 일 */
      readonly todo: TTodo;
      readonly todoIds: readonly number[];
      readonly precipitationChance: number;
    }
  | {
      readonly kind: "todoHot";
      readonly todo: TTodo;
      readonly todoIds: readonly number[];
      /** 그 할 일이 걸린 더운 시간대의 가장 높은 체감 온도 */
      readonly peakApparentTemperature: number;
    }
  | { readonly kind: "wetLater"; readonly startsAt: Temporal.Instant; readonly isSnow: boolean };

export type MorningWeatherBriefing =
  | TodayWeatherBriefing
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

type AffectedTodo<TTodo extends WeatherBriefingTodo> = ForecastTodo<
  TTodo,
  WeatherBriefingReportHour
>;

export function isThunderHour(hour: Pick<WeatherBriefingReportHour, "condition">): boolean {
  return hour.condition === "THUNDERSTORMS";
}

function isFrozen(precipitationType: WeatherPrecipitationType): boolean {
  return WEATHER_FROZEN_PRECIPITATION_TYPES.some((type) => type === precipitationType);
}

function isChilly(day: WeatherBriefingDay): boolean {
  return day.temperatureMin <= WEATHER_BRIEFING_RULES.CHILLY_TEMPERATURE;
}

function toDayPart(instant: Temporal.Instant, timezone: string): WeatherDayPart {
  const { hour } = instant.toZonedDateTimeISO(resolveTimezone(timezone));
  if (hour < WEATHER_BRIEFING_RULES.MORNING_START_HOUR) {
    return "dawn";
  }
  if (hour < WEATHER_BRIEFING_RULES.AFTERNOON_START_HOUR) {
    return "morning";
  }
  return hour < WEATHER_BRIEFING_RULES.EVENING_HOUR ? "afternoon" : "evening";
}

/** 뇌우와 겹친 할 일이 있으면 뇌우, 모두 눈이면 눈, 그 밖은 비다 */
function toWetHazard<TTodo extends WeatherBriefingTodo>(
  wetTodos: readonly AffectedTodo<TTodo>[],
  isStormy: boolean,
): WeatherWetHazard {
  if (isStormy) {
    return "storm";
  }
  return wetTodos.every(({ hour }) => isFrozen(hour.precipitationType)) ? "snow" : "rain";
}

function toWetBriefing<TTodo extends WeatherBriefingTodo>(
  wetTodos: readonly AffectedTodo<TTodo>[],
): TodayWeatherBriefing<TTodo> | null {
  const [earliest] = wetTodos;
  if (earliest == null) {
    return null;
  }
  const stormy = wetTodos.find(({ hour }) => isThunderHour(hour));
  const target = stormy ?? earliest;
  return {
    kind: "todoWet",
    hazard: toWetHazard(wetTodos, stormy != null),
    todo: target.todo,
    todoIds: wetTodos.map(({ todo }) => todo.id),
    precipitationChance: target.hour.precipitationChance,
  };
}

function toHotBriefing<TTodo extends WeatherBriefingTodo>(
  hourly: readonly WeatherBriefingReportHour[],
  hotTodos: readonly AffectedTodo<TTodo>[],
): TodayWeatherBriefing<TTodo> | null {
  const [earliest] = hotTodos;
  if (earliest == null) {
    return null;
  }
  const hotRun = findContiguousHours(
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

/** 지금 시간부터 오늘(알림 시간대) 안에 처음 비·눈이 오는 시간. 지금 시간이 비면 지금이다 */
function toWetLaterBriefing<TTodo extends WeatherBriefingTodo>(
  hourly: readonly WeatherBriefingReportHour[],
  { now, timezone }: WeatherBriefingClock,
): TodayWeatherBriefing<TTodo> | null {
  const today = localDateIn(now, timezone);
  const wetHour = hourly.find(
    (hour) =>
      Temporal.Instant.compare(hour.startsAt.add({ hours: 1 }), now) > 0 &&
      localDateIn(hour.startsAt, timezone).equals(today) &&
      isWetHour(hour),
  );
  if (wetHour == null) {
    return null;
  }
  const startsAt = Temporal.Instant.compare(wetHour.startsAt, now) < 0 ? now : wetHour.startsAt;
  return { kind: "wetLater", startsAt, isSnow: isFrozen(wetHour.precipitationType) };
}

/**
 * 오늘 알릴 날씨: 할 일과 겹친 비·뇌우·눈 → 할 일과 겹친 더위 → 오늘 늦게 오는 비·눈 순. 없으면 null이다.
 * 할 일과 겹친 날씨는 날씨 화면 브리핑과 같은 planWeatherBriefing이 정한다.
 */
export function decideTodayWeather<TTodo extends WeatherBriefingTodo>(
  forecast: WeatherBriefingForecast,
  todos: readonly TTodo[],
  clock: WeatherBriefingClock,
): TodayWeatherBriefing<TTodo> | null {
  const briefing = planWeatherBriefing({
    hourly: forecast.hourly,
    todos,
    now: clock.now,
    timezone: clock.timezone,
  });
  if (briefing.reason === "rain") {
    return toWetBriefing(briefing.affected);
  }
  if (briefing.reason === "heat") {
    return toHotBriefing(forecast.hourly, briefing.affected);
  }
  return toWetLaterBriefing(forecast.hourly, clock);
}

/** 위치 시간대 달력으로 오늘에서 days만큼 지난 날의 일별 예보 */
export function findLocationDay(
  forecast: WeatherBriefingForecast,
  { now, locationTimezone }: WeatherBriefingClock,
  days: number,
): WeatherBriefingDay | null {
  const date = localDateIn(now, locationTimezone).add({ days });
  return forecast.daily.find((day) => day.date.equals(date)) ?? null;
}

/**
 * 아침 알림: 오늘 알릴 날씨(decideTodayWeather)가 없으면 오늘 요약이다.
 * 위치 시간대의 오늘 일별 예보가 없으면 판단하지 않는다(null).
 */
export function decideMorningWeatherBriefing(
  forecast: WeatherBriefingForecast,
  todos: readonly TitledWeatherBriefingTodo[],
  clock: WeatherBriefingClock,
): MorningWeatherBriefing | null {
  const today = findLocationDay(forecast, clock, 0);
  if (today == null) {
    return null;
  }
  return decideTodayWeather(forecast, todos, clock) ?? { kind: "summary", day: today };
}

/**
 * 저녁 알림: 내일(알림 시간대) 비·눈이 시작하는 때와 쌀쌀함을, 없으면 내일 요약을 알린다.
 * 위치 시간대의 내일 일별 예보가 없으면 판단하지 않는다(null).
 */
export function decideEveningWeatherBriefing(
  forecast: WeatherBriefingForecast,
  clock: WeatherBriefingClock,
): EveningWeatherBriefing | null {
  const tomorrow = findLocationDay(forecast, clock, 1);
  if (tomorrow == null) {
    return null;
  }
  const deviceTomorrow = localDateIn(clock.now, clock.timezone).add({ days: 1 });
  const wetHour = forecast.hourly.find(
    (hour) => localDateIn(hour.startsAt, clock.timezone).equals(deviceTomorrow) && isWetHour(hour),
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
