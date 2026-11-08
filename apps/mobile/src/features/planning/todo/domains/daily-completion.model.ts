import { addDaysToDateKey, diffDateKeysInDays } from '@src/shared/date/date-key';
import { orderBy, range, uniq } from 'es-toolkit';

import type {
  DailyCompletionSummary,
  DailyCompletionsResult,
  MultiDayTodoSpan,
  Todo,
} from '../schemas/todo.schema';
import { TodoPolicy } from './todo.model';

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

function withDailyCompletionFromTodos(
  result: DailyCompletionsResult,
  date: string,
  todos: readonly Todo[],
): DailyCompletionsResult {
  const { startDate, endDate } = result.dateRange;
  const isInRange = startDate <= date && date <= endDate;
  if (!isInRange) {
    return result;
  }
  const dayTodos = todos.filter((todo) => TodoPolicy.isTodoOnDate(todo, date));
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

export const DailyCompletionPolicy = {
  withDailyCompletionFromTodos,
  withMultiDayTodoSpans,
} as const;
