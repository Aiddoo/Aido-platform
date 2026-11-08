import { addDaysToDateKey, diffDateKeysInDays } from '@src/shared/date/date-key';
import { orderBy, range, uniq } from 'es-toolkit';
import { z } from 'zod';

import { type Todo, TodoPolicy } from './todo.model';

const dailyCompletionSummarySchema = z.object({
  date: z.string(),
  totalTodos: z.int().min(0),
  completedTodos: z.int().min(0),
  isComplete: z.boolean(),
  completionRate: z.number().min(0).max(100),
  categoryColors: z.array(z.string()),
});
export type DailyCompletionSummary = z.infer<typeof dailyCompletionSummarySchema>;

// 여러 날 할 일은 mapper가 기간 안의 날에 펼쳐 넣어 결과에 따로 두지 않는다
export const dailyCompletionsResultSchema = z.object({
  completions: z.array(dailyCompletionSummarySchema),
  totalCompleteDays: z.int().min(0),
  dateRange: z.object({ startDate: z.string(), endDate: z.string() }),
});
export type DailyCompletionsResult = z.infer<typeof dailyCompletionsResultSchema>;

const multiDayTodoSpanSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  completed: z.boolean(),
  categoryColor: z.string(),
});
export type MultiDayTodoSpan = z.infer<typeof multiDayTodoSpanSchema>;

/** 서버는 GROUP BY 순서로 색을 모아 응답마다 순서가 바뀔 수 있다. 정렬해 두면 같은 날을 다시 받아도 달력이 다시 그려지지 않는다 */
export function toCategoryColors(colors: readonly string[]): string[] {
  return uniq(colors).sort();
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

// 서버 요약은 출시 앱 호환으로 여러 날 할 일을 시작일에만 센다. 달력 점이 목록과 같도록 나머지 날에 더한다
export function withMultiDayTodoSpans(
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
          categoryColors: toCategoryColors([
            ...(summary?.categoryColors ?? []),
            span.categoryColor,
          ]),
        }),
      );
    }
  }
  return withCompletions(result, [...byDate.values()]);
}

export function withTodoDailyCompletion(
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
            categoryColors: toCategoryColors(dayTodos.map((todo) => todo.category.color)),
          }),
        ],
  );
}

export const DailyCompletionPolicy = {
  toCategoryColors,
  withTodoDailyCompletion,
  withMultiDayTodoSpans,
} as const;
