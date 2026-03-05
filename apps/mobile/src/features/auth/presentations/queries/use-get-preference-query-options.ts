import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const useGetPreferenceQueryOptions = () => {
  const authService = useAuthService();

  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.preference(),
    queryFn: async () => {
      const result = await authService.getPreference();
      return unwrap(result);
    },
  });
};
