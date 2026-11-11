import { hashKey, type Query, type QueryClient } from '@tanstack/react-query';

import { type User } from '../domains/user.model';
import { USER_QUERY_KEYS } from './user-query-keys';
import type { useGetMeQueryOptions } from './user.queries';

/** 콜백·mutation 성공 처리처럼 훅 밖에서 현재 사용자가 필요할 때 쓴다 */
export function getCachedMe(queryClient: QueryClient): User | undefined {
  return queryClient.getQueryData(USER_QUERY_KEYS.me());
}

/** 받은 내 정보가 있으면 그대로, 없으면 받는다. 옵션의 select를 거친 값이다 */
export function ensureMe(
  queryClient: QueryClient,
  options: ReturnType<typeof useGetMeQueryOptions>,
) {
  return queryClient.query({ ...options, staleTime: 'static' });
}

export function invalidateMe(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
}

export function refetchMe(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: USER_QUERY_KEYS.me(), exact: true });
}

export function isMeQuery(query: Pick<Query, 'queryHash'>): boolean {
  return query.queryHash === hashKey(USER_QUERY_KEYS.me());
}
