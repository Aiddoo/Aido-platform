import { useQueryClient } from '@tanstack/react-query';

import { refreshMemos } from '../queries/memo-cache';

/** 다른 기능이 메모를 만들거나 지웠을 때 목록과 개수 한도를 다시 읽게 하는 함수를 route에 건넨다 */
export function useRefreshMemos() {
  const queryClient = useQueryClient();

  return () => refreshMemos(queryClient);
}
