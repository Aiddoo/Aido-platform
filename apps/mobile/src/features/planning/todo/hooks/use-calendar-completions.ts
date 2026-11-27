import type { DateKey } from '@src/shared/date/date-key';
import { useQuery } from '@tanstack/react-query';

import {
  selectCalendarCompletions,
  useGetDailyCompletionsQueryOptions,
} from '../queries/todo.queries';
import { getCalendarMonths } from '../utils/calendar-grid.view-model';

/** 고른 달을 받은 뒤 앞뒤 달을 미리 받아, 넘긴 달은 이미 받아 둔 이웃이라 점이 비는 프레임이 없다 */
export function useCalendarCompletions({ dateKey }: { dateKey: DateKey }) {
  const { selected, previous, next } = getCalendarMonths(dateKey);
  const selectedMonth = useQuery(useGetDailyCompletionsQueryOptions({ month: selected }));
  const isNeighborEnabled = selectedMonth.isSuccess;
  const { data: previousMonth } = useQuery({
    ...useGetDailyCompletionsQueryOptions({ month: previous }),
    enabled: isNeighborEnabled,
  });
  const { data: nextMonth } = useQuery({
    ...useGetDailyCompletionsQueryOptions({ month: next }),
    enabled: isNeighborEnabled,
  });

  return {
    completions: selectCalendarCompletions({
      selected: selectedMonth.data,
      previous: previousMonth,
      next: nextMonth,
    }),
    isError: selectedMonth.isError,
    error: selectedMonth.error,
    refetch: () => selectedMonth.refetch(),
  };
}
