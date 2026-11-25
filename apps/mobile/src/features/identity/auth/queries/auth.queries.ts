import { useAuthApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { LinkedAccountsPolicy, type LinkedAccountsResult } from '../domains/linked-accounts.model';
import { AUTH_QUERY_KEYS } from './auth-query-keys';

export function selectLinkedAccountCount(result: LinkedAccountsResult): number {
  return LinkedAccountsPolicy.countLinkedAccounts(result);
}

export function useGetLinkedAccountsQueryOptions() {
  const authApi = useAuthApi();

  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.linkedAccounts(),
    queryFn: async ({ signal }) => unwrap(await authApi.getLinkedAccounts(signal)),
  });
}
