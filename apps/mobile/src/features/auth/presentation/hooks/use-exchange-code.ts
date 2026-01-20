import { useAuthState } from '@src/core/providers/auth-state-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';
import { useAuthService } from '../providers/auth.provider';

export const useExchangeCode = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();
  const { setAuthenticated } = useAuthState();

  return useMutation({
    mutationFn: (code: string) => authService.exchangeCodeAndSaveTokens(code),
    onSuccess: async () => {
      setAuthenticated(true);
      await queryClient.invalidateQueries({
        queryKey: AUTH_QUERY_KEYS.all,
        refetchType: 'all',
      });
    },
  });
};
