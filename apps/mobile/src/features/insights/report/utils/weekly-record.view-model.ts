import { type DateKey, getIsoWeekDateRange, getWeekDateKeys } from '@src/shared/date/date-key';

export interface WeeklyRecordDay {
  date: DateKey;
  total: number;
  completed: number;
  isUpcoming: boolean;
}

type CompletionsByDate = Record<string, { totalTodos: number; completedTodos: number }>;

/** 이번 주(월요일 시작) 막대 7칸. 아직 오지 않은 날은 기록이 없어도 0이 아니라 아직으로 구분한다 */
export function getWeeklyRecordDays(
  completionsByDate: CompletionsByDate,
  todayKey: DateKey,
): WeeklyRecordDay[] {
  return getWeekDateKeys(getIsoWeekDateRange(todayKey).startDate).map((date) => {
    const completion = completionsByDate[date];

    return {
      date,
      total: completion?.totalTodos ?? 0,
      completed: completion?.completedTodos ?? 0,
      isUpcoming: todayKey < date,
    };
  });
}
