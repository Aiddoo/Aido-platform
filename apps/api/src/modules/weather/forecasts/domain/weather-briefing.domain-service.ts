import {
  WEATHER_BRIEFING_RULES,
  WEATHER_RESCHEDULE_MAX_TODO_IDS,
  type WeatherRescheduleReason,
} from "@aido/api/vocabulary";
import { orderBy } from "es-toolkit";

import { TIME_UNIT } from "#api/shared/domain/date/constants/date.constant";
import { dayWindowInTimezone } from "#api/shared/domain/date/utils/timezone";

import type { WeatherReportHour } from "./weather-report.vo.js";

/** 시트에 보여 줄 옮길 시간 후보 수. 첫 번째가 추천이다. */
const RESCHEDULE_OPTION_LIMIT = 4;

export type WeatherBriefingHour = Pick<
  WeatherReportHour,
  "startsAt" | "isDaylight" | "apparentTemperature" | "precipitationChance"
>;

/** 시각이 정해졌고 아직 하지 않은 할 일 */
export interface WeatherBriefingTodo {
  readonly id: number;
  readonly scheduledAt: Date;
}

interface WeatherRescheduleOption {
  readonly startsAt: Date;
  readonly precipitationChance: number;
  readonly apparentTemperature: number;
  readonly isRecommended: boolean;
}

export interface WeatherBriefing {
  /** 영향받는 할 일이 있을 때만 값이 있다. 비·눈이 더위보다 먼저다. */
  readonly reason: WeatherRescheduleReason | null;
  readonly affectedTodoIds: readonly number[];
  readonly rescheduleOptions: readonly {
    readonly todoId: number;
    readonly options: readonly WeatherRescheduleOption[];
  }[];
}

interface ForecastTodo {
  readonly todo: WeatherBriefingTodo;
  readonly hour: WeatherBriefingHour;
}

// 기준값은 날씨 푸시(notification weather-briefing.policy)와 앱 브리핑이 쓰는 WEATHER_BRIEFING_RULES 한곳이다.
// 푸시 정책은 notification이 소유해 public으로 열려 있지 않아 같은 규칙을 여기 둔다(통합할 때 한 곳으로 합친다).
function isWetHour(hour: Pick<WeatherBriefingHour, "precipitationChance">): boolean {
  return hour.precipitationChance >= WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE;
}

function isHotHour(hour: WeatherBriefingHour): boolean {
  return (
    hour.isDaylight && hour.apparentTemperature >= WEATHER_BRIEFING_RULES.HOT_APPARENT_TEMPERATURE
  );
}

function findHourAt(hourly: readonly WeatherBriefingHour[], at: Date): WeatherBriefingHour | null {
  const time = at.getTime();
  return (
    hourly.find(
      (hour) =>
        hour.startsAt.getTime() <= time && time < hour.startsAt.getTime() + TIME_UNIT.MS_PER_HOUR,
    ) ?? null
  );
}

/** 지금 이후 시각의 할 일을 그 시각의 시간별 예보와 묶는다. 예보 범위 밖이면 뺀다. */
function toForecastTodos(
  hourly: readonly WeatherBriefingHour[],
  todos: readonly WeatherBriefingTodo[],
  now: Date,
): ForecastTodo[] {
  const ordered = orderBy([...todos], [(todo) => todo.scheduledAt.getTime()], ["asc"]);
  return ordered.flatMap((todo) => {
    if (todo.scheduledAt.getTime() < now.getTime()) {
      return [];
    }
    const hour = findHourAt(hourly, todo.scheduledAt);
    return hour == null ? [] : [{ todo, hour }];
  });
}

/**
 * 할 일 날짜는 기기 시간대로 저장되므로 위치 시간대가 아니라 기기 시간대의 같은 날에서 후보를 고른다.
 * 비: 강수 확률이 낮은 시간, 더위: 할 일 시각과 가까운 시원한 시간이 먼저다.
 */
function planRescheduleOptions(params: {
  readonly hourly: readonly WeatherBriefingHour[];
  readonly todo: WeatherBriefingTodo;
  readonly now: Date;
  readonly timezone: string;
  readonly reason: WeatherRescheduleReason;
}): WeatherRescheduleOption[] {
  const { hourly, todo, now, timezone, reason } = params;
  const todoDay = dayWindowInTimezone(todo.scheduledAt, timezone).localDate;
  const distance = (hour: WeatherBriefingHour) =>
    Math.abs(hour.startsAt.getTime() - todo.scheduledAt.getTime());
  const sameDayHours = hourly.filter(
    (hour) =>
      hour.startsAt.getTime() > now.getTime() &&
      dayWindowInTimezone(hour.startsAt, timezone).localDate === todoDay,
  );
  const ordered =
    reason === "rain"
      ? orderBy(
          sameDayHours.filter((hour) => !isWetHour(hour)),
          [(hour) => hour.precipitationChance, distance],
          ["asc", "asc"],
        )
      : orderBy(
          sameDayHours.filter((hour) => !isWetHour(hour) && !isHotHour(hour)),
          [distance, (hour) => hour.apparentTemperature],
          ["asc", "asc"],
        );
  return ordered.slice(0, RESCHEDULE_OPTION_LIMIT).map((hour, index) => ({
    startsAt: hour.startsAt,
    precipitationChance: hour.precipitationChance,
    apparentTemperature: hour.apparentTemperature,
    isRecommended: index === 0,
  }));
}

/**
 * 오늘 할 일 가운데 날씨와 겹친 것과, 옮길 만한 시간 후보를 고른다.
 * 비·눈이 오는 시간에 걸린 할 일이 있으면 그것이, 없으면 더운 낮에 걸린 할 일이 영향받는 할 일이다.
 * 알림 대상 할 일을 고르는 순서(비·눈 → 더위)와 같다. 할 일은 앞에서부터 상한까지만 싣는다.
 */
export function planWeatherBriefing(params: {
  readonly hourly: readonly WeatherBriefingHour[];
  readonly todos: readonly WeatherBriefingTodo[];
  readonly now: Date;
  /** 할 일을 저장한 기기 시간대 */
  readonly timezone: string;
}): WeatherBriefing {
  const { hourly, todos, now, timezone } = params;
  const forecastTodos = toForecastTodos(hourly, todos, now);
  const wetTodos = forecastTodos.filter(({ hour }) => isWetHour(hour));
  const hotTodos = forecastTodos.filter(({ hour }) => isHotHour(hour));
  const reason: WeatherRescheduleReason | null =
    wetTodos.length > 0 ? "rain" : hotTodos.length > 0 ? "heat" : null;
  if (reason == null) {
    return { reason: null, affectedTodoIds: [], rescheduleOptions: [] };
  }

  const affected = (reason === "rain" ? wetTodos : hotTodos)
    .slice(0, WEATHER_RESCHEDULE_MAX_TODO_IDS)
    .map(({ todo }) => todo);
  return {
    reason,
    affectedTodoIds: affected.map((todo) => todo.id),
    rescheduleOptions: affected.map((todo) => ({
      todoId: todo.id,
      options: planRescheduleOptions({ hourly, todo, now, timezone, reason }),
    })),
  };
}
