import {
  WEATHER_BRIEFING_RULES,
  WEATHER_RESCHEDULE_MAX_TODO_IDS,
  type WeatherRescheduleReason,
} from "@aido/api/vocabulary";
import { orderBy } from "es-toolkit";

import { localDateAt } from "../../shared/domain/weather-calendar.domain-service.js";
import type { WeatherReportHour } from "./weather-report.vo.js";

/** 시트에 보여 줄 옮길 시간 후보 수. 첫 번째가 추천이다. */
const RESCHEDULE_OPTION_LIMIT = 4;
const HOUR_MS = 60 * 60_000;

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

/** 할 일과 그 시각의 시간별 예보 */
export interface ForecastTodo<
  TTodo extends WeatherBriefingTodo = WeatherBriefingTodo,
  THour extends WeatherBriefingHour = WeatherBriefingHour,
> {
  readonly todo: TTodo;
  readonly hour: THour;
}

export interface WeatherBriefing<
  TTodo extends WeatherBriefingTodo = WeatherBriefingTodo,
  THour extends WeatherBriefingHour = WeatherBriefingHour,
> {
  /** 영향받는 할 일이 있을 때만 값이 있다. 비·눈이 더위보다 먼저다. */
  readonly reason: WeatherRescheduleReason | null;
  /** 영향받는 할 일 전부(시각 순). 알림 문구가 고를 할 일과 시간을 본다 */
  readonly affected: readonly ForecastTodo<TTodo, THour>[];
  readonly affectedTodoIds: readonly number[];
  readonly rescheduleOptions: readonly {
    readonly todoId: number;
    readonly options: readonly WeatherRescheduleOption[];
  }[];
}

// 기준값은 날씨 화면·날씨 알림·앱이 함께 쓰는 WEATHER_BRIEFING_RULES 한곳이다
export function isWetHour(hour: Pick<WeatherBriefingHour, "precipitationChance">): boolean {
  return hour.precipitationChance >= WEATHER_BRIEFING_RULES.WET_HOUR_CHANCE;
}

export function isHotHour(
  hour: Pick<WeatherBriefingHour, "isDaylight" | "apparentTemperature">,
): boolean {
  return (
    hour.isDaylight && hour.apparentTemperature >= WEATHER_BRIEFING_RULES.HOT_APPARENT_TEMPERATURE
  );
}

/** 그 순간이 든 시간별 예보의 위치. 없으면 -1이다 */
export function findHourIndexAt(
  hourly: readonly Pick<WeatherBriefingHour, "startsAt">[],
  at: Date,
): number {
  const time = at.getTime();
  return hourly.findIndex(
    (hour) => hour.startsAt.getTime() <= time && time < hour.startsAt.getTime() + HOUR_MS,
  );
}

/** 지금 이후 시각의 할 일을 그 시각의 시간별 예보와 묶는다. 예보 범위 밖이면 뺀다. */
function toForecastTodos<TTodo extends WeatherBriefingTodo, THour extends WeatherBriefingHour>(
  hourly: readonly THour[],
  todos: readonly TTodo[],
  now: Date,
): ForecastTodo<TTodo, THour>[] {
  const ordered = orderBy([...todos], [(todo) => todo.scheduledAt.getTime()], ["asc"]);
  return ordered.flatMap((todo) => {
    if (todo.scheduledAt.getTime() < now.getTime()) {
      return [];
    }
    const hour = hourly[findHourIndexAt(hourly, todo.scheduledAt)];
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
  const todoDay = localDateAt(todo.scheduledAt, timezone);
  const distance = (hour: WeatherBriefingHour) =>
    Math.abs(hour.startsAt.getTime() - todo.scheduledAt.getTime());
  const sameDayHours = hourly.filter(
    (hour) =>
      hour.startsAt.getTime() > now.getTime() &&
      localDateAt(hour.startsAt, timezone).equals(todoDay),
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
 * 오늘 할 일 가운데 날씨와 겹친 것과, 옮길 만한 시간 후보를 고른다. 날씨 화면 브리핑과 아침 날씨 알림이 함께 쓴다.
 * 비·눈이 오는 시간에 걸린 할 일이 있으면 그것이, 없으면 더운 낮에 걸린 할 일이 영향받는 할 일이다.
 * 옮기기 대상 id와 후보는 앞에서부터 상한까지만 싣는다.
 */
export function planWeatherBriefing<
  TTodo extends WeatherBriefingTodo,
  THour extends WeatherBriefingHour,
>(params: {
  readonly hourly: readonly THour[];
  readonly todos: readonly TTodo[];
  readonly now: Date;
  /** 할 일을 저장한 기기 시간대 */
  readonly timezone: string;
}): WeatherBriefing<TTodo, THour> {
  const { hourly, todos, now, timezone } = params;
  const forecastTodos = toForecastTodos(hourly, todos, now);
  const wetTodos = forecastTodos.filter(({ hour }) => isWetHour(hour));
  const hotTodos = forecastTodos.filter(({ hour }) => isHotHour(hour));
  const reason: WeatherRescheduleReason | null =
    wetTodos.length > 0 ? "rain" : hotTodos.length > 0 ? "heat" : null;
  if (reason == null) {
    return { reason: null, affected: [], affectedTodoIds: [], rescheduleOptions: [] };
  }

  const affected = reason === "rain" ? wetTodos : hotTodos;
  const shown = affected.slice(0, WEATHER_RESCHEDULE_MAX_TODO_IDS).map(({ todo }) => todo);
  return {
    reason,
    affected,
    affectedTodoIds: shown.map((todo) => todo.id),
    rescheduleOptions: shown.map((todo) => ({
      todoId: todo.id,
      options: planRescheduleOptions({ hourly, todo, now, timezone, reason }),
    })),
  };
}
