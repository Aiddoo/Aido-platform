import { TokenStore } from '@src/shared/storage/token-store';
import { useQuery } from '@tanstack/react-query';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';
import { useAuthService } from '../providers/auth.provider';

export const useGetMe = () => {
  const authService = useAuthService();

  return useQuery({
    queryKey: AUTH_QUERY_KEYS.me(),
    queryFn: async () => {
      const token = await TokenStore.getAccessToken();
      if (!token) return null;
      return authService.getCurrentUser();
    },
    retry: false,
  });
};
