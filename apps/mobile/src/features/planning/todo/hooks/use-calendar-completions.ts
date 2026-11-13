import type { DateKey } from '@src/shared/date/date-key';
import { useQuery } from '@tanstack/react-query';

import { useGetDailyCompletionsQueryOptions } from '../queries/todo.queries';
import {
  getCalendarMonthRanges,
  mergeCalendarCompletions,
} from '../utils/calendar-grid.view-model';

/**
 * 고른 달을 받은 뒤 앞뒤 달을 미리 받는다. 넘긴 달은 이미 받아 둔 이웃이라 점이 비는 프레임이 없다.
 * 처음 열 때는 고른 달 하나만 먼저 묻고, 오류·다시 시도는 고른 달 기준이다
 */
export function useCalendarCompletions({ dateKey }: { dateKey: DateKey }) {
  const { selected, previous, next } = getCalendarMonthRanges(dateKey);
  const selectedMonth = useQuery(useGetDailyCompletionsQueryOptions(selected));
  const isNeighborEnabled = selectedMonth.isSuccess;
  const { data: previousMonth } = useQuery({
    ...useGetDailyCompletionsQueryOptions(previous),
    enabled: isNeighborEnabled,
  });
  const { data: nextMonth } = useQuery({
    ...useGetDailyCompletionsQueryOptions(next),
    enabled: isNeighborEnabled,
  });

  return {
    completions: mergeCalendarCompletions({
      selected: selectedMonth.data,
      previous: previousMonth,
      next: nextMonth,
    }),
    isError: selectedMonth.isError,
    error: selectedMonth.error,
    refetch: () => selectedMonth.refetch(),
  };
}
