import type { QueryClient } from '@tanstack/react-query';

import { USER_QUERY_KEYS } from '../constants/user-query-keys';
import type { User } from '../domains/user.model';

/** 이미 불러온 내 정보. 콜백·mutation 성공 처리처럼 훅 밖에서 현재 사용자가 필요할 때 쓴다. */
export function getCachedMe(queryClient: QueryClient): User | undefined {
  return queryClient.getQueryData<User>(USER_QUERY_KEYS.me());
}

/** 프리미엄·친구 자리처럼 서버가 계산하는 내 정보가 바뀌었을 때 다시 불러온다. */
export function invalidateMe(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
}
