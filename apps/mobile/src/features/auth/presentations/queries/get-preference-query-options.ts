import { useAuthService } from '@src/bootstrap/providers/di-context';
import type { AuthService } from '@src/features/auth/services/auth.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export function getPreferenceQueryOptions(authService: AuthService) {
  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.preference(),
    queryFn: async ({ signal }) => {
      const result = await authService.getPreference(signal);
      return unwrap(result);
    },
  });
}

export function useGetPreferenceQueryOptions() {
  return getPreferenceQueryOptions(useAuthService());
}
