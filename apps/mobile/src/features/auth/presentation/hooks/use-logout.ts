/**
 * useLogout Hook (Presentation Layer)
 *
 * 로그아웃을 처리하는 Mutation Hook입니다.
 * 성공 시 모든 인증 관련 쿼리를 무효화하여 캐시를 정리합니다.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';
import { useAuthService } from '../providers/auth.provider';

export const useLogout = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: AUTH_QUERY_KEYS.all,
        refetchType: 'all',
      });
    },
  });
};
