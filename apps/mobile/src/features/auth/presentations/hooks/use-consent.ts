import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useQuery } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

/**
 * Hook for fetching user consent
 */
export const useConsent = () => {
  const authService = useAuthService();

  return useQuery({
    queryKey: AUTH_QUERY_KEYS.consent(),
    queryFn: () => authService.getConsent(),
  });
};
