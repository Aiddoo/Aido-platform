import { hashKey, type Query, type QueryClient } from '@tanstack/react-query';

import { USER_QUERY_KEYS } from '../constants/user-query-keys';
import { type User } from '../domains/user.model';

export function getCachedMe(queryClient: QueryClient): User | undefined {
  return queryClient.getQueryData<User>(USER_QUERY_KEYS.me());
}

// 서버가 계산하는 값이라 바뀌면 다시 불러온다
export function invalidateMe(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.me() });
}

export function refetchMe(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: USER_QUERY_KEYS.me(), exact: true });
}

export function isMeQuery(query: Pick<Query, 'queryHash'>): boolean {
  return query.queryHash === hashKey(USER_QUERY_KEYS.me());
}
