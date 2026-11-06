import { toDate, toDateKey } from '@src/shared/date/instant';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useCallback, useMemo } from 'react';

import { CLEARED_TODO_SELECTION, feedParamsSchema } from '../schemas/feed-params.schema';
import { toFeedDateKey } from '../utils/feed-date-key';

/** 피드에서 고른 날짜. 오늘을 고르면 URL에서 `date`를 지워 자정이 지나면 새 오늘을 따라간다 */
export function useFeedDateParam() {
  const [{ date }, setParams] = useRouteParams(feedParamsSchema);
  const { currentLocalDateKey, currentTimeZone, currentUtcOffsetMinutes } = useLocalDate();
  const selectedDateKey = toFeedDateKey(date, currentLocalDateKey);
  const selectedDate = useMemo(
    () => toDate(selectedDateKey),
    [selectedDateKey, currentTimeZone, currentUtcOffsetMinutes],
  );
  const setSelectedDate = useCallback(
    (next: Date) => {
      const nextDateKey = toDateKey(next, currentTimeZone);
      setParams({ date: nextDateKey === currentLocalDateKey ? undefined : nextDateKey });
    },
    [currentLocalDateKey, currentTimeZone, setParams],
  );

  return [selectedDate, setSelectedDate] as const;
}

/** 피드에서 고른 날짜의 YYYY-MM-DD */
export function useFeedDateKey(): string {
  const [{ date }] = useRouteParams(feedParamsSchema);
  return toFeedDateKey(date, useTodayKey());
}

/** 피드의 친구. 없으면 내 피드다. 친구를 바꾸면 날짜만 남기고 이전 피드의 할 일과 요청을 지운다 */
export function useFeedFriendParam() {
  const [{ friendId }, setParams] = useRouteParams(feedParamsSchema);
  const selectFriend = useCallback(
    (next: string | undefined) =>
      setParams({ ...CLEARED_TODO_SELECTION, friendId: next, action: undefined }),
    [setParams],
  );

  return [friendId, selectFriend] as const;
}

/** 위젯·딥링크가 피드에 보낸 요청 */
export function useFeedActionParam() {
  const [{ action }, setParams] = useRouteParams(feedParamsSchema);
  const setAction = useCallback((next: typeof action) => setParams({ action: next }), [setParams]);

  return [action, setAction] as const;
}
