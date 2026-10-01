import { useAuthService } from '@src/bootstrap/providers/di-context';
import type { AuthService } from '@src/features/auth/services/auth.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export function getLinkedAccountsQueryOptions(authService: AuthService) {
  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.linkedAccounts(),
    queryFn: async ({ signal }) => {
      const result = await authService.getLinkedAccounts(signal);
      return unwrap(result);
    },
  });
}

export function useGetLinkedAccountsQueryOptions() {
  return getLinkedAccountsQueryOptions(useAuthService());
}
