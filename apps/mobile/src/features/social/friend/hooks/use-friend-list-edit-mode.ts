import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useCallback } from 'react';

import { friendListParamsSchema } from '../schemas/friend-params.schema';

/**
 * 친구 목록 편집 모드 상태를 관리하는 훅.
 *
 * 편집 모드가 활성화되면 드래그 핸들과 삭제 버튼이 노출된다.
 * route params 기반으로 동작하여, 스크린(헤더 버튼)과 FriendList(목록 렌더링)가
 * props 없이 동일한 상태를 구독할 수 있다. 끄면 `?isEditing=false`를 남기지 않고 값을 지운다.
 *
 * @returns `[isEditMode, setIsEditMode]` — useState와 동일한 튜플 형태
 */
export function useFriendListEditMode() {
  const [{ isEditing }, setParams] = useRouteParams(friendListParamsSchema);
  const setIsEditMode = useCallback(
    (value: boolean) => setParams({ isEditing: value ? true : undefined }),
    [setParams],
  );

  return [isEditing, setIsEditMode] as const;
}
