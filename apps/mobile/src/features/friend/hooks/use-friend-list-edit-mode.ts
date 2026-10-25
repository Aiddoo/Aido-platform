import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

const friendListEditSearchSchema = z.object({
  isEditing: z.stringbool().catch(false),
});

/**
 * 친구 목록 편집 모드 상태를 관리하는 훅.
 *
 * 편집 모드가 활성화되면 드래그 핸들과 삭제 버튼이 노출된다.
 * route params 기반으로 동작하여, 스크린(헤더 버튼)과 FriendList(목록 렌더링)가
 * props 없이 동일한 상태를 구독할 수 있다.
 *
 * @returns `[isEditMode, setIsEditMode]` — useState와 동일한 튜플 형태
 */
export function useFriendListEditMode(): readonly [boolean, (isEditMode: boolean) => void] {
  const { isEditing } = friendListEditSearchSchema.parse(useLocalSearchParams());

  const setIsEditMode = useCallback((value: boolean) => {
    router.setParams({ isEditing: value ? 'true' : undefined });
  }, []);

  return [isEditing, setIsEditMode] as const;
}
