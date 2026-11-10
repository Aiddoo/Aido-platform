import { type WeatherRescheduleReason } from '@aido/api/vocabulary';
import { type Instant, toEpochMs, toHHmm } from '@src/shared/date/instant';
import { keyBy } from 'es-toolkit';

import {
  type AffectedTodo,
  type BriefingTodo,
  WeatherBriefingPolicy,
} from './weather-briefing.model';
import type {
  HourlyForecastEntry,
  RescheduleOption,
  WeatherReportBriefing,
} from './weather-report.model';

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

/** 후보 시각은 할 일과 같은 날(기기 시간대)이라 날짜는 두고 시각(기기 시간대 HH:mm)만 바꾼다 */
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

/** 시트를 연 사이 지워졌거나 완료된 할 일(다른 기기·알림 동작)은 옮기지 않는다 */
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

/**
 * 시트 링크의 할 일 중 서버가 지금도 같은 이유로 영향받는다고 본 할 일. 시트를 연 사이 끝낸 할 일은 뺀다.
 * 서버가 판단하지 못했거나(briefing 없음) 이유가 바뀌었으면 앱이 다시 판단하지 않고 옮기지 않는다.
 */
function getRescheduleTodos(
  report: { hourly: readonly HourlyForecastEntry[]; briefing: WeatherReportBriefing | null },
  todos: readonly BriefingTodo[],
  { now, reason }: { now: Instant; reason: WeatherRescheduleReason },
): AffectedTodo[] {
  const { briefing } = report;
  if (briefing == null || briefing.reason !== reason) {
    return [];
  }
  const forecastTodos = WeatherBriefingPolicy.getForecastTodos(report.hourly, todos, now);
  return WeatherBriefingPolicy.getAffectedTodos(briefing, forecastTodos).filter(
    (todo) => !todo.completed,
  );
}

/** 서버가 고른 후보 중 아직 지나지 않은 시각. 리포트를 받은 뒤 정시를 넘기면 지난 후보가 빠진다. */
function getUpcomingOptions(
  options: readonly RescheduleOption[],
  now: Instant,
): RescheduleOption[] {
  return options.filter((option) => toEpochMs(option.startsAt) > toEpochMs(now));
}

/** 시트를 연 채 지난 선택을 바꿀 다음 후보. 서버 후보가 모두 지났으면 null이다. */
function findNextRescheduleOption(
  briefing: Pick<WeatherReportBriefing, 'rescheduleOptions'> | null,
  { todoId, now }: { todoId: number; now: Instant },
): RescheduleOption | null {
  const entry = briefing?.rescheduleOptions.find((candidate) => candidate.todoId === todoId);
  return getUpcomingOptions(entry?.options ?? [], now)[0] ?? null;
}

export const WeatherReschedulePolicy = {
  getRescheduleTodos,
  getUpcomingOptions,
  findNextRescheduleOption,
  getMovedScheduleInput,
  getOriginalScheduleInput,
  getRescheduleTargets,
  getExpiredTargets,
} as const;
