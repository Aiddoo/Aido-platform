import { type WeatherRescheduleReason } from '@aido/api/vocabulary';
import { type Instant, toDateKey, toEpochMs, toHHmm } from '@src/shared/date/instant';
import { keyBy, orderBy } from 'es-toolkit';
import { match } from 'ts-pattern';

import {
  type BriefingTodo,
  type ForecastTodo,
  WeatherBriefingPolicy,
} from './weather-briefing.model';
import type { HourlyForecastEntry } from './weather-report.model';
import { WeatherReportPolicy } from './weather-report.model';

const RESCHEDULE_OPTION_LIMIT = 4;

export interface RescheduleOption {
  startsAt: Instant;
  precipitationChance: number;
  apparentTemperature: number;
  isRecommended: boolean;
}

export interface ScheduleChange {
  todoId: number;
  startsAt: Instant;
}

interface TodoScheduleSnapshot {
  startDate: string;
  endDate: string | null;
  localTime: string | null;
  isAllDay: boolean;
}

interface TodoScheduleInput {
  startDate: string;
  endDate: string | null;
  scheduledTime: string | null;
  isAllDay: boolean;
}

function getMovedScheduleInput(
  todo: Pick<TodoScheduleSnapshot, 'startDate' | 'endDate'>,
  startsAt: Instant,
  timeZone: string,
): TodoScheduleInput {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: toHHmm(startsAt, timeZone),
    isAllDay: false,
  };
}

function getOriginalScheduleInput(todo: TodoScheduleSnapshot): TodoScheduleInput {
  return {
    startDate: todo.startDate,
    endDate: todo.endDate,
    scheduledTime: todo.isAllDay ? null : todo.localTime,
    isAllDay: todo.isAllDay,
  };
}

interface RescheduleTarget<TTodo> {
  todo: TTodo;
  startsAt: Instant;
}

/** 실제로 옮길 할 일과 시각 */
function getRescheduleTargets<TTodo extends { id: number; completed: boolean }>(
  changes: readonly ScheduleChange[],
  todos: readonly TTodo[],
): RescheduleTarget<TTodo>[] {
  const todosById = keyBy(todos, (todo) => todo.id);
  return changes.flatMap(({ todoId, startsAt }) => {
    const todo = todosById[todoId];
    return todo == null || todo.completed ? [] : [{ todo, startsAt }];
  });
}

/** 시트를 연 채 정시를 넘겨 이미 지난 시각이 된 선택. 지난 시각으로는 옮기지 않는다. */
function getExpiredTargets<TTodo>(
  targets: readonly RescheduleTarget<TTodo>[],
  now: Instant,
): RescheduleTarget<TTodo>[] {
  return targets.filter(({ startsAt }) => toEpochMs(startsAt) <= toEpochMs(now));
}

function getRainyTodos(
  hourly: readonly HourlyForecastEntry[],
  todos: readonly BriefingTodo[],
  now: Instant,
): ForecastTodo[] {
  return WeatherBriefingPolicy.getForecastTodos(hourly, todos, now).filter(
    (todo) => !todo.completed && WeatherReportPolicy.isWetHour(todo.hour),
  );
}

function getHotTodos(
  hourly: readonly HourlyForecastEntry[],
  todos: readonly BriefingTodo[],
  now: Instant,
): ForecastTodo[] {
  return WeatherBriefingPolicy.getForecastTodos(hourly, todos, now).filter(
    (todo) => !todo.completed && WeatherBriefingPolicy.isHot(todo.hour),
  );
}

function getAffectedTodos(
  hourly: readonly HourlyForecastEntry[],
  todos: readonly BriefingTodo[],
  { now, reason }: { now: Instant; reason: WeatherRescheduleReason },
): ForecastTodo[] {
  return match(reason)
    .with('rain', () => getRainyTodos(hourly, todos, now))
    .with('heat', () => getHotTodos(hourly, todos, now))
    .exhaustive();
}

function getRescheduleOptions(
  hourly: readonly HourlyForecastEntry[],
  todo: Pick<ForecastTodo, 'scheduledAt'>,
  { now, timeZone, reason }: { now: Instant; timeZone: string; reason: WeatherRescheduleReason },
): RescheduleOption[] {
  const todoDateKey = toDateKey(todo.scheduledAt, timeZone);
  const distance = (hour: HourlyForecastEntry) =>
    Math.abs(toEpochMs(hour.startsAt) - toEpochMs(todo.scheduledAt));
  const sameDayHours = hourly.filter(
    (hour) =>
      toEpochMs(hour.startsAt) > toEpochMs(now) &&
      toDateKey(hour.startsAt, timeZone) === todoDateKey,
  );
  const ordered = match(reason)
    .with('rain', () =>
      orderBy(
        sameDayHours.filter((hour) => !WeatherReportPolicy.isWetHour(hour)),
        [(hour) => hour.precipitationChance, distance],
        ['asc', 'asc'],
      ),
    )
    .with('heat', () =>
      orderBy(
        sameDayHours.filter(
          (hour) => !WeatherReportPolicy.isWetHour(hour) && !WeatherBriefingPolicy.isHot(hour),
        ),
        [distance, (hour) => hour.apparentTemperature],
        ['asc', 'asc'],
      ),
    )
    .exhaustive();
  return ordered.slice(0, RESCHEDULE_OPTION_LIMIT).map((hour, index) => ({
    startsAt: hour.startsAt,
    precipitationChance: hour.precipitationChance,
    apparentTemperature: hour.apparentTemperature,
    isRecommended: index === 0,
  }));
}

export const WeatherReschedulePolicy = {
  getAffectedTodos,
  getRescheduleOptions,
  getMovedScheduleInput,
  getOriginalScheduleInput,
  getRescheduleTargets,
  getExpiredTargets,
} as const;
