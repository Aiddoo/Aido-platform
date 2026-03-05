import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const useGetConsentQueryOptions = () => {
  const authService = useAuthService();

  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.consent(),
    queryFn: async () => {
      const result = await authService.getConsent();
      return unwrap(result);
    },
  });
};
