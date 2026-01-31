import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useQuery } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

/**
 * Hook for fetching user preference
 */
export const usePreference = () => {
  const authService = useAuthService();

  return useQuery({
    queryKey: AUTH_QUERY_KEYS.preference(),
    queryFn: () => authService.getPreference(),
  });
};
