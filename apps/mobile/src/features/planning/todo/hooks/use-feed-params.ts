import type { DateKey } from '@src/shared/date/date-key';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTodayKey } from '@src/shared/hooks/use-today-key';

import {
  CLEARED_TODO_SELECTION,
  feedParamsSchema,
  toFeedDateKey,
} from '../schemas/feed-params.schema';

/** 피드에서 고른 날짜 key. 오늘을 고르면 URL에서 `date`를 지워 자정이 지나면 새 오늘을 따라간다 */
export function useFeedDateKey() {
  const [{ date }, setParams] = useRouteParams(feedParamsSchema);
  const todayKey = useTodayKey();
  const setSelectedDateKey = (nextDateKey: DateKey) =>
    setParams({ date: nextDateKey === todayKey ? undefined : nextDateKey });

  return [toFeedDateKey(date, todayKey), setSelectedDateKey] as const;
}

/** 피드의 친구. 없으면 내 피드다. 친구를 바꾸면 날짜만 남기고 이전 피드의 할 일과 요청을 지운다 */
export function useFeedFriendId() {
  const [{ friendId }, setParams] = useRouteParams(feedParamsSchema);
  const selectFriend = (next: string | undefined) =>
    setParams({ ...CLEARED_TODO_SELECTION, friendId: next, action: undefined });

  return [friendId, selectFriend] as const;
}

/** 위젯·딥링크가 피드에 보낸 요청 */
export function useFeedAction() {
  const [{ action }, setParams] = useRouteParams(feedParamsSchema);
  const setAction = (next: typeof action) => setParams({ action: next });

  return [action, setAction] as const;
}

/** 펼친 화면의 옆 칸에 고른 할 일. 할 일이 바뀌면 댓글 위치·정렬을 버리고 같은 할 일은 그대로 둔다 */
export function useFeedSelectedTodoId() {
  const [{ todoId: selectedTodoId }, setParams] = useRouteParams(feedParamsSchema);
  const setSelectedTodoId = (todoId: number | undefined) => {
    if (todoId !== selectedTodoId) {
      setParams({ ...CLEARED_TODO_SELECTION, todoId });
    }
  };

  return [selectedTodoId, setSelectedTodoId] as const;
}
