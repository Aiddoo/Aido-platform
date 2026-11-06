import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import { type FriendListView, friendListParamsSchema } from '../schemas/friend-params.schema';

/** 친구 화면의 탭 */
export function useFriendListViewParam() {
  const [{ view }, setParams] = useRouteParams(friendListParamsSchema);
  const setView = useCallback((next: FriendListView) => setParams({ view: next }), [setParams]);

  return [view, setView] as const;
}
