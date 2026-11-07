import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import {
  FRIEND_LIST_VIEW,
  friendListParamsSchema,
  friendListViewSchema,
} from '../schemas/friend-params.schema';

/** 친구 화면의 탭. 탭이 주는 값을 검증하고, 친구 탭이 아닌 곳으로 옮기면 편집 모드를 함께 끈다 */
export function useFriendListViewParam() {
  const [{ view }, setParams] = useRouteParams(friendListParamsSchema);
  const setView = useCallback(
    (value: string) => {
      const parsed = friendListViewSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      setParams(
        parsed.data === FRIEND_LIST_VIEW.friends
          ? { view: parsed.data }
          : { view: parsed.data, isEditing: undefined },
      );
    },
    [setParams],
  );

  return [view, setView] as const;
}
