import { addDaysToDateKey, diffDateKeysInDays } from '@src/shared/date/date-key';
import { toHHmm } from '@src/shared/date/instant';

import type { SubTodo } from '../schemas/sub-todo.schema';
import type { Todo } from '../schemas/todo.schema';

/** 정하지 않은(null, 생략) 공개 범위는 서버 기본값인 공개로 본다 */
function getVisibility(todo: { visibility?: Todo['visibility'] | null }): Todo['visibility'] {
  return todo.visibility ?? 'PUBLIC';
}

/** 비공개 할 일은 친구에게 보이지 않는다 */
function isPrivate(todo: { visibility: Todo['visibility'] | null }): boolean {
  return getVisibility(todo) === 'PRIVATE';
}

function withVisibilityToggled<T extends { visibility: Todo['visibility'] | null }>(todo: T): T {
  return { ...todo, visibility: isPrivate(todo) ? 'PUBLIC' : 'PRIVATE' };
}

/** 종일이 아닌 시각만 비교한다. 종일끼리는 남은 시각 값이 달라도 바뀐 것이 아니다 */
function hasScheduleChanged(
  next: Pick<Todo, 'isAllDay'> & { scheduledTime: string | null },
  previous: Pick<Todo, 'isAllDay'> & { scheduledTime: string | null },
): boolean {
  return (
    next.isAllDay !== previous.isAllDay ||
    (!next.isAllDay && next.scheduledTime !== previous.scheduledTime)
  );
}

/** 시트 route의 대상 할 일. 목록에서 사라졌으면(삭제·다른 날짜) null */
function findTodo(todos: readonly Todo[], todoId: number): Todo | null {
  return todos.find((todo) => todo.id === todoId) ?? null;
}

function findSubTodo(todo: Pick<Todo, 'subTodos'> | null, subTodoId: number): SubTodo | null {
  return todo?.subTodos.find((subTodo) => subTodo.id === subTodoId) ?? null;
}

function isRecurringTodo(todo: Todo): boolean {
  return todo.recurrenceGroupId != null;
}

function isMultiDayTodo(todo: Pick<Todo, 'startDate' | 'endDate'>): boolean {
  return todo.endDate != null && todo.endDate !== todo.startDate;
}

function getShiftedEndDate(
  todo: Pick<Todo, 'startDate' | 'endDate'>,
  startDate: string,
): string | null {
  return todo.endDate == null
    ? null
    : addDaysToDateKey(startDate, diffDateKeysInDays(todo.startDate, todo.endDate));
}

/** 서버 응답 전의 임시 행. 임시 id로는 요청을 보낼 수 없다 */
function isOptimisticTodo(todo: Pick<Todo, 'id'>): boolean {
  return todo.id < 0;
}

function hasSubTodos(todo: Todo): boolean {
  return todo.subTodoStats.total > 0;
}

/**
 * 이 할 일을 끝내면 그날 목록이 모두 끝나는지. 할 일이 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다.
 * 여러 날에 걸친 할 일은 시작일 목록만 낙관적으로 바뀌므로 끝낸 할 일은 목록 값과 무관하게 완료로 본다.
 */
function isLastOpenTodo(todos: readonly Todo[], completedTodoId: number): boolean {
  return (
    todos.some((todo) => todo.id === completedTodoId) &&
    todos.every((todo) => todo.id === completedTodoId || todo.completed)
  );
}

function isTodoOnDate(todo: Pick<Todo, 'startDate' | 'endDate'>, date: string): boolean {
  return todo.startDate <= date && date <= (todo.endDate ?? todo.startDate);
}

/**
 * 사용자가 고른 벽시계. 서버가 준 값은 어디서든 그 시각이고, 서버가 칸을 비워 둔 시간 행만 순간을 보는 시간대로 읽는다.
 * 종일이거나 시간이 없으면 null이다
 */
function getLocalTime(
  todo: Pick<Todo, 'isAllDay' | 'localTime' | 'scheduledAt'>,
  timeZone: string,
): string | null {
  if (todo.isAllDay) {
    return null;
  }
  if (todo.localTime != null) {
    return todo.localTime;
  }
  return todo.scheduledAt == null ? null : toHHmm(todo.scheduledAt, timeZone);
}

/** 완료 전이고 시간이 있으며 아직 지나지 않은 할 일이 있는가. 시각은 어디서든 그 시각이라 벽시계로 비교한다 */
function hasUpcomingTimedTodo(
  todos: readonly Todo[],
  now: { dateKey: string; time: string; timeZone: string },
): boolean {
  return todos.some((todo) => {
    const localTime = getLocalTime(todo, now.timeZone);
    return (
      !todo.completed &&
      localTime != null &&
      (todo.startDate > now.dateKey || (todo.startDate === now.dateKey && localTime > now.time))
    );
  });
}

/** 상세 화면은 피드 날짜를 모른다. 오늘이 기간 안이면 오늘 목록을, 아니면 시작일 목록을 먼저 고친다 */
function getOptimisticListDate(
  todo: Pick<Todo, 'startDate' | 'endDate'>,
  todayKey: string,
): string {
  return isTodoOnDate(todo, todayKey) ? todayKey : todo.startDate;
}

const MIN_REORDERABLE_COUNT = 2;

/** 순서를 바꾸려면 같은 묶음에 할 일이 둘 이상 있어야 한다 */
function canReorderTodos(todos: readonly Pick<Todo, 'id'>[]) {
  return todos.length >= MIN_REORDERABLE_COUNT;
}

export const TodoPolicy = {
  canReorderTodos,
  getVisibility,
  isPrivate,
  withVisibilityToggled,
  hasScheduleChanged,
  findTodo,
  findSubTodo,
  getOptimisticListDate,
  isTodoOnDate,
  isRecurringTodo,
  isMultiDayTodo,
  getShiftedEndDate,
  isOptimisticTodo,
  hasSubTodos,
  isLastOpenTodo,
  getLocalTime,
  hasUpcomingTimedTodo,
} as const;
