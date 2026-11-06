import { useAuthService } from '@src/bootstrap/providers/di-context';
import type { AuthService } from '@src/features/identity/auth/apis/auth.service';
import { AUTH_QUERY_KEYS } from '@src/features/identity/auth/constants/auth-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

export function getConsentQueryOptions(authService: AuthService) {
  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.consent(),
    queryFn: async ({ signal }) => {
      const result = await authService.getConsent(signal);
      return unwrap(result);
    },
  });
}

export function useGetConsentQueryOptions() {
  return getConsentQueryOptions(useAuthService());
}
