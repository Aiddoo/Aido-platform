import { useFriendScreenParams } from '@src/features/friend/hooks/use-friend-screen-params';
import { useQuery } from '@tanstack/react-query';
import { match } from 'ts-pattern';

import { useGetFriendDailyCompletionsQueryOptions } from '../../queries/get-friend-daily-completions-query-options';
import { Calendar } from './calendar';
import { useCalendarRange } from './use-calendar-range';

/** 친구 화면의 친구가 공개(PUBLIC)한 완료 현황을 표시하는 캘린더. 틀은 내 캘린더와 같다. */
export function FriendCalendar() {
  const { friendId } = useFriendScreenParams();
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
      status={match(query)
        .with({ isError: true }, () => <Calendar.Error onRetry={() => query.refetch()} />)
        .with({ isPending: true }, () => <Calendar.MarkerLoading />)
        .otherwise(() => undefined)}
    />
  );
}
