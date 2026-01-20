import { useAuthState } from '@src/core/providers/auth-state-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';
import { useAuthService } from '../providers/auth.provider';

export const useLogout = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();
  const { clearAuth } = useAuthState();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: async () => {
      clearAuth();
      await queryClient.invalidateQueries({
        queryKey: AUTH_QUERY_KEYS.all,
        refetchType: 'all',
      });
    },
  });
};
