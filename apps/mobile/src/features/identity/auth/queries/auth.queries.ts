import { useAuthApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from './auth-query-keys';

export function useGetLinkedAccountsQueryOptions() {
  const authApi = useAuthApi();

  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.linkedAccounts(),
    queryFn: async ({ signal }) => unwrap(await authApi.getLinkedAccounts(signal)),
  });
}
