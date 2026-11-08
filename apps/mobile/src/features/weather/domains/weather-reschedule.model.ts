import { type WeatherRescheduleReason } from '@aido/api/vocabulary';
import { type Instant, toDateKey, toEpochMs, toHHmm } from '@src/shared/date/instant';
import { keyBy, orderBy } from 'es-toolkit';
import { match } from 'ts-pattern';

import type { HourlyForecastEntry } from '../schemas/weather-report.schema';
import {
  type BriefingTodo,
  type ForecastTodo,
  WeatherBriefingPolicy,
} from './weather-briefing.model';
import { WeatherReportPolicy } from './weather-report.model';

/** 시트에 보여 줄 옮길 시간 후보 수. 첫 번째가 추천이다. */
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

/**
 * 후보 시각은 할 일과 같은 날(기기 시간대)이라 날짜는 그대로 두고 시각만 바꾼다.
 * 할 일 시각은 기기 시간대의 HH:mm으로 저장한다.
 */
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

/** 되돌리기: 옮기기 전 날짜·시각·종일 여부를 그대로 다시 저장한다. */
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

/**
 * 실제로 옮길 할 일과 시각. 시트를 연 사이 지워졌거나 완료된 할 일(다른 기기·알림 동작·날짜가 바뀐 목록)은 옮기지 않는다.
 * 비어 있으면 옮길 것이 없으므로 주 버튼을 끈다.
 */
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

/** 아직 하지 않은 할 일 중 지금 이후 시각이 비 오는 시간에 걸린 것만 고른다. 종일·시간 없는 할 일은 뺀다. */
function getRainyTodos(
  hourly: readonly HourlyForecastEntry[],
  todos: readonly BriefingTodo[],
  now: Instant,
): ForecastTodo[] {
  return WeatherBriefingPolicy.getForecastTodos(hourly, todos, now).filter(
    (todo) => !todo.completed && WeatherReportPolicy.isWetHour(todo.hour),
  );
}

/** 아직 하지 않은 할 일 중 체감 온도가 위험한 낮 시간에 걸린 것만 고른다. */
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

/**
 * 같은 날(기기 시간대) 안에서 지금 이후의 정시를 옮길 후보로 고른다. 할 일 날짜는 기기 시간대로 저장되므로
 * 위치 시간대가 아니라 기기 시간대로 날짜를 맞춘다.
 * 비는 비 안 오는 시간을 강수 확률이 낮은 순으로, 더위는 덥지 않은 시간을 원래 시각과 가까운 순으로 고른다.
 */
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
