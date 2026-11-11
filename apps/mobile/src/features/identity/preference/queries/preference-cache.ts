import type { QueryClient } from '@tanstack/react-query';

import type { useGetPreferenceQueryOptions } from './preference.queries';

/** 받은 설정이 있으면 그대로, 없으면 받는다 */
export function ensurePreference(
  queryClient: QueryClient,
  options: ReturnType<typeof useGetPreferenceQueryOptions>,
) {
  return queryClient.ensureQueryData(options);
}
