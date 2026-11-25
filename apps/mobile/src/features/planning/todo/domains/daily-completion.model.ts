import { completionRate, isAllCompleted } from '@aido/api/vocabulary';
import {
  addMonthsToDateKey,
  dateKeySchema,
  getCalendarWeek,
  getMonthEndDateKey,
  getMonthStartDateKey,
  type DateKey,
} from '@src/shared/date/date-key';
import { completionRateSchema } from '@src/shared/domains/completion-rate.model';
import { orderBy, uniq } from 'es-toolkit';
import { z } from 'zod';

import { type Todo, TodoPolicy } from './todo.model';

const dailyCompletionSummarySchema = z.object({
  date: dateKeySchema,
  totalTodos: z.int().min(0),
  completedTodos: z.int().min(0),
  isComplete: z.boolean(),
  completionRate: completionRateSchema,
  categoryColors: z.array(z.string()),
});
export type DailyCompletionSummary = z.infer<typeof dailyCompletionSummarySchema>;

export const dailyCompletionsResultSchema = z.object({
  completions: z.array(dailyCompletionSummarySchema),
  totalCompleteDays: z.int().min(0),
  dateRange: z.object({ startDate: dateKeySchema, endDate: dateKeySchema }),
});
export type DailyCompletionsResult = z.infer<typeof dailyCompletionsResultSchema>;

export interface DailyCompletionRange {
  startDate: DateKey;
  endDate: DateKey;
}

/** 한 달(그 달 1일)의 완료 기록으로 받는 범위: 그 달을 일요일 시작 주로 채운 달력 칸 전체 */
export function getCompletionMonthRange(month: DateKey): DailyCompletionRange {
  return {
    startDate: getCalendarWeek(getMonthStartDateKey(month)).startDateKey,
    endDate: getCalendarWeek(getMonthEndDateKey(month)).endDateKey,
  };
}

function isRangeWithin(range: DailyCompletionRange, outer: DailyCompletionRange): boolean {
  return outer.startDate <= range.startDate && range.endDate <= outer.endDate;
}

/** 그 기간을 덮는 가장 적은 달들(각 달 1일). 한 달 칸이 덮으면 그 달 하나, 아니면 걸친 달 모두다 */
export function getCompletionMonthsCovering(range: DailyCompletionRange): [DateKey, ...DateKey[]] {
  const firstMonth = getMonthStartDateKey(range.startDate);
  const lastMonth = getMonthStartDateKey(range.endDate);
  const months: [DateKey, ...DateKey[]] = [firstMonth];
  for (
    let month = addMonthsToDateKey(firstMonth, 1);
    month <= lastMonth;
    month = addMonthsToDateKey(month, 1)
  ) {
    months.push(month);
  }
  const coveringMonth = months.find((month) =>
    isRangeWithin(range, getCompletionMonthRange(month)),
  );
  return coveringMonth == null ? months : [coveringMonth];
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
    isComplete: isAllCompleted(completedTodos, totalTodos),
    completionRate: completionRate(completedTodos, totalTodos),
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

export const DailyCompletionPolicy = {
  /** 서버는 GROUP BY 순서로 색을 모아 응답마다 순서가 바뀔 수 있다. 정렬해 두면 같은 날을 다시 받아도 달력이 다시 그려지지 않는다 */
  toCategoryColors(colors: readonly string[]): string[] {
    return uniq(colors).sort();
  },

  withTodoDailyCompletion(
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
              categoryColors: this.toCategoryColors(dayTodos.map((todo) => todo.category.color)),
            }),
          ],
    );
  },
};
