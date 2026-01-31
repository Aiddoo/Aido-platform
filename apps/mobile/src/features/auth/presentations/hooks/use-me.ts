import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useQuery } from '@tanstack/react-query';

import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

/**
 * Hook for fetching current user
 */
export const useMe = () => {
  const authService = useAuthService();

  return useQuery({
    queryKey: AUTH_QUERY_KEYS.me(),
    queryFn: () => authService.getCurrentUser(),
  });
};
