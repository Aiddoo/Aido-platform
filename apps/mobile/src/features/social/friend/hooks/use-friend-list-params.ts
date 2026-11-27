import { useRouteParams } from '@src/shared/hooks/use-route-params';

import {
  FRIEND_LIST_VIEW,
  friendListParamsSchema,
  type FriendListView,
} from '../schemas/friend-params.schema';

/** 친구 화면의 탭. 친구 탭이 아닌 곳으로 옮기면 편집 모드를 함께 끈다 */
export function useFriendListView() {
  const [{ view }, setParams] = useRouteParams(friendListParamsSchema);
  const setView = (next: FriendListView) =>
    setParams(
      next === FRIEND_LIST_VIEW.friends ? { view: next } : { view: next, isEditing: undefined },
    );

  return [view, setView] as const;
}

/** route params 기반이라 헤더 버튼과 FriendList가 props 없이 같은 상태를 구독한다 */
export function useFriendListIsEditing() {
  const [{ isEditing }, setParams] = useRouteParams(friendListParamsSchema);
  const setIsEditing = (next: boolean) => setParams({ isEditing: next ? true : undefined });

  return [isEditing, setIsEditing] as const;
}
