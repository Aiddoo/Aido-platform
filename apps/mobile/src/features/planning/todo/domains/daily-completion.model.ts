import { dateKeySchema, type DateKey } from '@src/shared/date/date-key';
import { orderBy, uniq } from 'es-toolkit';
import { z } from 'zod';

import { type Todo, TodoPolicy } from './todo.model';

const dailyCompletionSummarySchema = z.object({
  date: dateKeySchema,
  totalTodos: z.int().min(0),
  completedTodos: z.int().min(0),
  isComplete: z.boolean(),
  completionRate: z.number().min(0).max(100),
  categoryColors: z.array(z.string()),
});
export type DailyCompletionSummary = z.infer<typeof dailyCompletionSummarySchema>;

export const dailyCompletionsResultSchema = z.object({
  completions: z.array(dailyCompletionSummarySchema),
  totalCompleteDays: z.int().min(0),
  dateRange: z.object({ startDate: dateKeySchema, endDate: dateKeySchema }),
});
export type DailyCompletionsResult = z.infer<typeof dailyCompletionsResultSchema>;

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

export function withTodoDailyCompletion(
  result: DailyCompletionsResult,
  date: DateKey,
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
} as const;
