import type { DefaultError, EnsureQueryDataOptions, QueryClient } from '@tanstack/react-query';

import type { Preference } from '../domains/preference.model';
import { PREFERENCE_QUERY_KEYS } from './preference-query-keys';

/** 조회 함수가 DI Api를 써서 `useGetPreferenceQueryOptions`가 만든다 */
type PreferenceQueryOptions = EnsureQueryDataOptions<
  Preference,
  DefaultError,
  Preference,
  ReturnType<typeof PREFERENCE_QUERY_KEYS.current>
>;

/** 받은 설정이 있으면 그대로, 없으면 받는다 */
export function ensurePreference(queryClient: QueryClient, options: PreferenceQueryOptions) {
  return queryClient.ensureQueryData(options);
}

export function cancelPreference(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: PREFERENCE_QUERY_KEYS.current() });
}

export function getCachedPreference(queryClient: QueryClient) {
  return queryClient.getQueryData(PREFERENCE_QUERY_KEYS.current());
}

export function setPreferenceInCache(queryClient: QueryClient, preference: Preference) {
  queryClient.setQueryData(PREFERENCE_QUERY_KEYS.current(), preference);
}

/** 받은 설정이 있을 때만 바꾼다 */
export function updatePreferenceInCache(
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
