import { useQuery } from '@tanstack/react-query';

import { useCalendarRange } from '../../hooks/use-calendar-range';
import { useGetFriendDailyCompletionsQueryOptions } from '../../queries/todo.queries';
import { Calendar } from './calendar';

interface FriendCalendarProps {
  /** 피드가 친구 목록에서 확인한 친구의 id. route 값은 더는 친구가 아닌 사람일 수 있어 그대로 읽지 않는다 */
  friendId: string;
}

/** 친구가 공개(PUBLIC)한 완료 현황을 표시하는 캘린더. 틀은 내 캘린더와 같다. */
export function FriendCalendar({ friendId }: FriendCalendarProps) {
  const [{ rangeStart, rangeEnd }] = useCalendarRange();
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
