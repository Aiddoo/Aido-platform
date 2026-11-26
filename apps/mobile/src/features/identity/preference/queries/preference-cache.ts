import { settleOverlappingWrite } from '@src/shared/query/settle-overlapping-write';
import type { DefaultError, QueryExecuteOptions, QueryClient } from '@tanstack/react-query';

import type { Preference } from '../domains/preference.model';
import { PREFERENCE_MUTATION_KEYS } from './preference-mutation-keys';
import { PREFERENCE_QUERY_KEYS } from './preference-query-keys';

/** 조회 함수가 DI Api를 써서 `useGetPreferenceQueryOptions`가 만든다 */
type PreferenceQueryOptions = QueryExecuteOptions<
  Preference,
  DefaultError,
  Preference,
  Preference,
  ReturnType<typeof PREFERENCE_QUERY_KEYS.current>
>;

export function ensurePreference(queryClient: QueryClient, options: PreferenceQueryOptions) {
  return queryClient.query({ ...options, staleTime: 'static' });
}

export function cancelPreference(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: PREFERENCE_QUERY_KEYS.current() });
}

export function getCachedPreference(queryClient: QueryClient) {
  return queryClient.getQueryData(PREFERENCE_QUERY_KEYS.current());
}

/** 저장 응답을 쓴다. 겹친 저장은 응답 대신 마지막에 서버 값을 다시 받는다 */
export function settlePreferenceWrite(
  queryClient: QueryClient,
  { saved, startedWithOthers }: { saved: Preference; startedWithOthers: boolean },
) {
  return settleOverlappingWrite(queryClient, {
    mutationKey: PREFERENCE_MUTATION_KEYS.writes(),
    queryKey: PREFERENCE_QUERY_KEYS.current(),
    startedWithOthers,
    writeResponse: () => queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), saved),
  });
}

/** 받은 설정이 있을 때만 바꾼다 */
export function setPreferenceInCache(
  queryClient: QueryClient,
  update: (preference: Preference) => Preference,
) {
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), (preference) =>
    preference == null ? preference : update(preference),
  );
}

export function invalidatePreference(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: PREFERENCE_QUERY_KEYS.current() });
}
