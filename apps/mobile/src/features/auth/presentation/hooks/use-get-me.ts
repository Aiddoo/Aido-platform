/**
 * useGetMe Hook (Presentation Layer)
 *
 * 현재 로그인된 사용자 정보를 조회하는 Query Hook입니다.
 * 액세스 토큰이 있을 때만 서버에 요청을 보냅니다.
 */

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
