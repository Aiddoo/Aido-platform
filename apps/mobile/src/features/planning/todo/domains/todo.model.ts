import { addDaysToDateKey, diffDateKeysInDays } from '@src/shared/date/date-key';
import { orderBy, range, uniq } from 'es-toolkit';

import type { SubTodo } from '../schemas/sub-todo.schema';
import type {
  DailyCompletionSummary,
  DailyCompletionsResult,
  MultiDayTodoSpan,
  Todo,
  TodoDetails,
} from '../schemas/todo.schema';

/** 비공개 할 일은 친구에게 보이지 않는다 */
/** 정하지 않은(null) 공개 범위는 서버 기본값인 공개로 본다 */
function isPrivate(todo: { visibility: Todo['visibility'] | null }): boolean {
  return todo.visibility === 'PRIVATE';
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
function completesAllTodos(todos: readonly Todo[], completedTodoId: number): boolean {
  return (
    todos.some((todo) => todo.id === completedTodoId) &&
    todos.every((todo) => todo.id === completedTodoId || todo.completed)
  );
}

function createDailyCompletionSummary(
  summary: Pick<
    DailyCompletionSummary,
    'date' | 'totalTodos' | 'completedTodos' | 'categoryColors'
  >,
): DailyCompletionSummary {
  const { totalTodos, completedTodos } = summary;
  return {
    ...summary,
    isComplete: totalTodos === completedTodos,
    completionRate: Math.round((completedTodos / totalTodos) * 100),
  };
}

function withCompletions(
  result: DailyCompletionsResult,
  completions: readonly DailyCompletionSummary[],
): DailyCompletionsResult {
  const sorted = orderBy(completions, [(completion) => completion.date], ['asc']);
  return {
    ...result,
    completions: sorted,
    totalCompleteDays: sorted.filter((completion) => completion.isComplete).length,
  };
}

/**
 * 서버 요약은 출시 앱이 읽는 대로 여러 날 할 일을 시작일에만 센다.
 * 그날 목록에 보이는 할 일과 달력 점이 같도록 기간 안의 나머지 날에 더한다.
 */
function withMultiDayTodoSpans(
  result: DailyCompletionsResult,
  spans: readonly MultiDayTodoSpan[],
): DailyCompletionsResult {
  if (spans.length === 0) {
    return result;
  }
  const { startDate: rangeStart, endDate: rangeEnd } = result.dateRange;
  const byDate = new Map(result.completions.map((completion) => [completion.date, completion]));
  for (const span of spans) {
    const firstDay = span.startDate < rangeStart ? rangeStart : addDaysToDateKey(span.startDate, 1);
    const lastDay = span.endDate > rangeEnd ? rangeEnd : span.endDate;
    for (const offset of range(Math.max(0, diffDateKeysInDays(firstDay, lastDay) + 1))) {
      const date = addDaysToDateKey(firstDay, offset);
      const summary = byDate.get(date);
      byDate.set(
        date,
        createDailyCompletionSummary({
          date,
          totalTodos: (summary?.totalTodos ?? 0) + 1,
          completedTodos: (summary?.completedTodos ?? 0) + (span.completed ? 1 : 0),
          categoryColors: uniq([...(summary?.categoryColors ?? []), span.categoryColor]),
        }),
      );
    }
  }
  return withCompletions(result, [...byDate.values()]);
}

function isTodoOnDate(todo: Pick<Todo, 'startDate' | 'endDate'>, date: string): boolean {
  return todo.startDate <= date && (todo.endDate ?? todo.startDate) >= date;
}

function withDailyCompletionFromTodos(
  result: DailyCompletionsResult,
  date: string,
  todos: readonly Todo[],
): DailyCompletionsResult {
  if (date < result.dateRange.startDate || date > result.dateRange.endDate) {
    return result;
  }
  const dayTodos = todos.filter((todo) => isTodoOnDate(todo, date));
  const others = result.completions.filter((completion) => completion.date !== date);
  return withCompletions(
    result,
    dayTodos.length === 0
      ? others
      : [
          ...others,
          createDailyCompletionSummary({
            date,
            totalTodos: dayTodos.length,
            completedTodos: dayTodos.filter((todo) => todo.completed).length,
            categoryColors: uniq(dayTodos.map((todo) => todo.category.color)),
          }),
        ],
  );
}

/** 완료 전이고 시간이 있으며 아직 지나지 않은 할 일이 있는가. 시각은 어디서든 그 시각이라 벽시계로 비교한다 */
function hasUpcomingTimedTodo(
  todos: readonly Todo[],
  now: { dateKey: string; time: string },
): boolean {
  return todos.some(
    (todo) =>
      !todo.completed &&
      todo.localTime != null &&
      (todo.startDate > now.dateKey ||
        (todo.startDate === now.dateKey && todo.localTime > now.time)),
  );
}

/** 서버가 준 수정 권한이 곧 내 할 일이다. 사용자 id를 다시 비교하지 않는다 */
function isOwnTodo(details: Pick<TodoDetails, 'permissions'>): boolean {
  return details.permissions.canEdit;
}

/** 상세 화면은 피드 날짜를 모른다. 오늘이 기간 안이면 오늘 목록을, 아니면 시작일 목록을 먼저 고친다 */
function getDetailListDate(todo: Pick<Todo, 'startDate' | 'endDate'>, todayKey: string): string {
  return isTodoOnDate(todo, todayKey) ? todayKey : todo.startDate;
}

export const TodoPolicy = {
  isPrivate,
  findTodo,
  findSubTodo,
  isOwnTodo,
  getDetailListDate,
  isTodoOnDate,
  isRecurringTodo,
  isMultiDayTodo,
  getShiftedEndDate,
  isOptimisticTodo,
  withDailyCompletionFromTodos,
  withMultiDayTodoSpans,
  hasSubTodos,
  completesAllTodos,
  hasUpcomingTimedTodo,
} as const;
