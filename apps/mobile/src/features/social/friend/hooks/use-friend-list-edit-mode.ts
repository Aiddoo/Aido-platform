import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import { friendListParamsSchema } from '../schemas/friend-params.schema';

/**
 * route params 기반이라 헤더 버튼과 FriendList가 props 없이 같은 상태를 구독한다.
 * 끄면 `?isEditing=false`를 남기지 않고 값을 지운다.
 */
export function useFriendListEditMode() {
  const [{ isEditing }, setParams] = useRouteParams(friendListParamsSchema);
  const setIsEditMode = useCallback(
    (value: boolean) => setParams({ isEditing: value ? true : undefined }),
    [setParams],
  );

  return [isEditing, setIsEditMode] as const;
}
