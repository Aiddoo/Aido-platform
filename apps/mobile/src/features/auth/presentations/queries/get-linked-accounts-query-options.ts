import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';
import type { LinkedAccount } from '../../models/oauth.model';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const getLinkedAccountsQueryOptions = () => {
  const authService = useAuthService();

  return queryOptions<LinkedAccount[]>({
    queryKey: AUTH_QUERY_KEYS.linkedAccounts(),
    queryFn: async () => {
      const result = await authService.getLinkedAccounts();
      return unwrap(result);
    },
  });
};
