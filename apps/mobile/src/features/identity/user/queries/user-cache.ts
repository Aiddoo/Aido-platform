import {
  type DefaultError,
  hashKey,
  type Query,
  type QueryClient,
  type QueryExecuteOptions,
} from '@tanstack/react-query';

import { type User } from '../domains/user.model';
import { USER_QUERY_KEYS } from './user-query-keys';

/** 내 정보 조회 옵션. 조회 함수가 DI Api를 써서 `useGetMeQueryOptions`가 만들고 고른 값(select)은 옵션이 정한다 */
type MeQueryOptions<TData> = QueryExecuteOptions<
  User,
  DefaultError,
  TData,
  User,
  ReturnType<typeof USER_QUERY_KEYS.me>
>;

/** 콜백·mutation 성공 처리처럼 훅 밖에서 현재 사용자가 필요할 때 쓴다 */
export function getCachedMe(queryClient: QueryClient): User | undefined {
  return queryClient.getQueryData(USER_QUERY_KEYS.me());
}

/** 받은 내 정보가 있으면 그대로, 없으면 받는다. 옵션의 select를 거친 값이다 */
export function ensureMe<TData>(queryClient: QueryClient, options: MeQueryOptions<TData>) {
  return queryClient.query({ ...options, staleTime: 'static' });
}

export function cancelMe(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: USER_QUERY_KEYS.me() });
}

/** 받은 내 정보가 있을 때만 바꾼다 */
export function updateMeInCache(queryClient: QueryClient, update: (me: User) => User) {
  queryClient.setQueryData(USER_QUERY_KEYS.me(), (me) => (me == null ? me : update(me)));
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
