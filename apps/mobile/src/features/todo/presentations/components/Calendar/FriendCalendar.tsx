import { useQuery } from '@tanstack/react-query';

import { useGetFriendDailyCompletionsQueryOptions } from '../../queries/use-get-friend-daily-completions-query-options';
import { Calendar } from './Calendar';
import { useCalendarRange } from './use-calendar-range';

interface FriendCalendarProps {
  friendUserId: string;
}

/** 친구의 공개(PUBLIC) 완료 현황을 표시하는 캘린더 — 틀은 내 캘린더와 동일 */
export function FriendCalendar({ friendUserId }: FriendCalendarProps) {
  const { rangeStart, rangeEnd } = useCalendarRange();
  const { data } = useQuery(
    useGetFriendDailyCompletionsQueryOptions(friendUserId, rangeStart, rangeEnd),
  );

  return <Calendar completions={data} />;
}
