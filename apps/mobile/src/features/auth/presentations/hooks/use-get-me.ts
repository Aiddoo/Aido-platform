import { TokenStore } from '@src/core/storage';
import { queryOptions } from '@tanstack/react-query';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';
import type { AuthClient } from '../contexts/auth.context';

export const useGetMeQueryOptions = (authClient: AuthClient) => {
  const { authService } = authClient;

  return queryOptions({
    queryKey: AUTH_QUERY_KEYS.me(),
    queryFn: async () => {
      const token = await TokenStore.getAccessToken();
      if (!token) return null;
      return authService.getCurrentUser();
    },
    retry: false,
  });
};
