import type { DateKey } from '@src/shared/date/date-key';
import { useQuery } from '@tanstack/react-query';

import { useGetFriendDailyCompletionsQueryOptions } from '../queries/todo.queries';
import {
  getCalendarMonthRanges,
  mergeCalendarCompletions,
} from '../utils/calendar-grid.view-model';

/** 내 달력과 같다. 볼 수 없는 친구면 고른 달 하나만 실패하고 앞뒤 달은 묻지 않는다 */
export function useFriendCalendarCompletions({
  friendUserId,
  dateKey,
}: {
  friendUserId: string;
  dateKey: DateKey;
}) {
  const { selected, previous, next } = getCalendarMonthRanges(dateKey);
  const selectedMonth = useQuery(
    useGetFriendDailyCompletionsQueryOptions({ ...selected, friendUserId }),
  );
  const isNeighborEnabled = selectedMonth.isSuccess;
  const { data: previousMonth } = useQuery({
    ...useGetFriendDailyCompletionsQueryOptions({ ...previous, friendUserId }),
    enabled: isNeighborEnabled,
  });
  const { data: nextMonth } = useQuery({
    ...useGetFriendDailyCompletionsQueryOptions({ ...next, friendUserId }),
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
