/**
 * useExchangeCode Hook (Presentation Layer)
 *
 * OAuth 인증 코드를 교환하여 토큰을 발급받는 Mutation Hook입니다.
 * 성공 시 모든 인증 관련 쿼리를 무효화하여 최신 상태를 유지합니다.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';
import { useAuthService } from '../providers/auth.provider';

export const useExchangeCode = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => authService.exchangeCodeAndSaveTokens(code),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: AUTH_QUERY_KEYS.all,
        refetchType: 'all',
      });
    },
  });
};
