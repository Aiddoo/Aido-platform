import { useQuery } from '@tanstack/react-query';

import { useCalendarRange } from '../../hooks/use-calendar-range';
import { useGetFriendDailyCompletionsQueryOptions } from '../../queries/todo.queries';
import { Calendar } from './calendar';

/** 친구가 공개(PUBLIC)한 완료 현황을 표시하는 캘린더. 틀은 내 캘린더와 같다. */
export function FriendCalendar({ friendId }: { friendId: string }) {
  const { rangeStart, rangeEnd } = useCalendarRange();
  const query = useQuery(
    useGetFriendDailyCompletionsQueryOptions({
      friendUserId: friendId,
      startDate: rangeStart,
      endDate: rangeEnd,
    }),
  );

  return (
    <Calendar
      completions={query.data}
      status={query.isError ? <Calendar.Error onRetry={() => query.refetch()} /> : undefined}
    />
  );
}
