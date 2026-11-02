import type { WeatherPrecipitationType } from '@aido/api';
import { formatDateKey } from '@src/shared/utils/date-format';
import { orderBy } from 'es-toolkit';

import { type HourlyForecast, isWetHour } from './weather-report.model';

const HOUR_MS = 60 * 60_000;
/** 시트에 보여 줄 옮길 시간 후보 수. 첫 번째가 추천이다. */
const RESCHEDULE_OPTION_LIMIT = 4;

/** 할 일 피처의 모델에 기대지 않도록 브리핑에 필요한 값만 받는다. 시간이 없거나 종일이면 scheduledAt이 null이다. */
export interface BriefingTodo {
  id: number;
  title: string;
  scheduledAt: Date | null;
  completed: boolean;
}

/** 할 일 목록의 값을 브리핑 입력으로 바꾼다. 종일 할 일은 시각이 있어도 시간대를 정하지 않은 것으로 본다. */
export function toBriefingTodo(todo: {
  id: number;
  title: string;
  scheduledAtMs: number | null;
  isAllDay: boolean;
  completed: boolean;
}): BriefingTodo {
  return {
    id: todo.id,
    title: todo.title,
    scheduledAt: todo.isAllDay || todo.scheduledAtMs == null ? null : new Date(todo.scheduledAtMs),
    completed: todo.completed,
  };
}

export interface RainyTodo {
  todoId: number;
  title: string;
  scheduledAt: Date;
  precipitationChance: number;
  precipitationType: WeatherPrecipitationType;
}

export interface RescheduleOption {
  startsAt: Date;
  precipitationChance: number;
  isRecommended: boolean;
}

export type WeatherBriefing =
  | { kind: 'noScheduledTodos' }
  | { kind: 'dry'; scheduledCount: number }
  | { kind: 'rainy'; rainyTodos: RainyTodo[] };

function findHourAt(hourly: readonly HourlyForecast[], at: Date): HourlyForecast | null {
  const time = at.getTime();
  return (
    hourly.find(
      (hour) => hour.startsAt.getTime() <= time && time < hour.startsAt.getTime() + HOUR_MS,
    ) ?? null
  );
}

/** 아직 하지 않은 할 일 중 지금 이후 시각이 비 오는 시간에 걸린 것만 고른다. 종일·시간 없는 할 일은 뺀다. */
export function getRainyTodos(
  hourly: readonly HourlyForecast[],
  todos: readonly BriefingTodo[],
  now: Date,
): RainyTodo[] {
  return todos.flatMap((todo) => {
    if (todo.completed || todo.scheduledAt == null || todo.scheduledAt.getTime() < now.getTime()) {
      return [];
    }
    const hour = findHourAt(hourly, todo.scheduledAt);
    if (hour == null || !isWetHour(hour)) {
      return [];
    }
    return [
      {
        todoId: todo.id,
        title: todo.title,
        scheduledAt: todo.scheduledAt,
        precipitationChance: hour.precipitationChance,
        precipitationType: hour.precipitationType,
      },
    ];
  });
}

export function toWeatherBriefing(
  hourly: readonly HourlyForecast[],
  todos: readonly BriefingTodo[],
  now: Date,
): WeatherBriefing {
  const scheduledCount = todos.filter(
    (todo) =>
      !todo.completed && todo.scheduledAt != null && todo.scheduledAt.getTime() >= now.getTime(),
  ).length;
  if (scheduledCount === 0) {
    return { kind: 'noScheduledTodos' };
  }
  const rainyTodos = getRainyTodos(hourly, todos, now);
  return rainyTodos.length === 0 ? { kind: 'dry', scheduledCount } : { kind: 'rainy', rainyTodos };
}

/**
 * 같은 날(기기 시간대) 안에서 지금 이후의 비 안 오는 정시를 강수 확률이 낮은 순, 같으면 원래 시각과 가까운 순으로 고른다.
 * 할 일 날짜는 기기 시간대로 저장되므로 위치 시간대가 아니라 기기 시간대로 날짜를 맞춘다.
 */
export function getRescheduleOptions(
  hourly: readonly HourlyForecast[],
  todo: Pick<RainyTodo, 'scheduledAt'>,
  { now, timeZone }: { now: Date; timeZone: string },
): RescheduleOption[] {
  const todoDateKey = formatDateKey(todo.scheduledAt, timeZone);
  const candidates = hourly.filter(
    (hour) =>
      hour.startsAt.getTime() > now.getTime() &&
      !isWetHour(hour) &&
      formatDateKey(hour.startsAt, timeZone) === todoDateKey,
  );
  return orderBy(
    candidates,
    [
      (hour) => hour.precipitationChance,
      (hour) => Math.abs(hour.startsAt.getTime() - todo.scheduledAt.getTime()),
    ],
    ['asc', 'asc'],
  )
    .slice(0, RESCHEDULE_OPTION_LIMIT)
    .map((hour, index) => ({
      startsAt: hour.startsAt,
      precipitationChance: hour.precipitationChance,
      isRecommended: index === 0,
    }));
}

export const WeatherBriefingPolicy = {
  briefingTodo: toBriefingTodo,
  briefing: toWeatherBriefing,
  rainyTodos: getRainyTodos,
  rescheduleOptions: getRescheduleOptions,
} as const;
