import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import { addDaysToDateKey, type DateKey, getMondayOfDateKey } from '@src/shared/date/date-key';
import { range } from 'es-toolkit';

export interface WeeklyRecordDay {
  date: DateKey;
  total: number;
  completed: number;
  isUpcoming: boolean;
}

type CompletionsByDate = Record<string, { totalTodos: number; completedTodos: number }>;

export function getWeeklyRecordRange(todayKey: DateKey) {
  const startDate = getMondayOfDateKey(todayKey);
  return { startDate, endDate: addDaysToDateKey(startDate, DAYS_PER_WEEK - 1) };
}

export function getWeeklyRecordDays(
  completionsByDate: CompletionsByDate,
  todayKey: DateKey,
): WeeklyRecordDay[] {
  const { startDate } = getWeeklyRecordRange(todayKey);

  return range(DAYS_PER_WEEK).map((offset) => {
    const date = addDaysToDateKey(startDate, offset);
    const completion = completionsByDate[date];

    return {
      date,
      total: completion?.totalTodos ?? 0,
      completed: completion?.completedTodos ?? 0,
      isUpcoming: todayKey < date,
    };
  });
}
