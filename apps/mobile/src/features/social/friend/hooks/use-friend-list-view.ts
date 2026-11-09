import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import {
  FRIEND_LIST_VIEW,
  friendListParamsSchema,
  type FriendListView,
} from '../schemas/friend-params.schema';

/** 친구 화면의 탭. 친구 탭이 아닌 곳으로 옮기면 편집 모드를 함께 끈다 */
export function useFriendListView() {
  const [{ view }, setParams] = useRouteParams(friendListParamsSchema);
  const setView = useCallback(
    (next: FriendListView) =>
      setParams(
        next === FRIEND_LIST_VIEW.friends ? { view: next } : { view: next, isEditing: undefined },
      ),
    [setParams],
  );

  return [view, setView] as const;
}
