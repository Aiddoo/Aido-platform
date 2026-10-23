import type { QueryClient } from '@tanstack/react-query';

import { USER_QUERY_KEYS } from '../constants/user-query-keys';
import type { User } from '../domains/user.model';

/** 이미 불러온 내 정보. 콜백·mutation 성공 처리처럼 훅 밖에서 현재 사용자가 필요할 때 쓴다. */
export function getCachedMe(queryClient: QueryClient): User | undefined {
  return queryClient.getQueryData<User>(USER_QUERY_KEYS.me());
}
