import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';
import type { AuthClient } from '../contexts/auth.context';

export const useExchangeCodeMutationOptions = (authClient: AuthClient) => {
  const { authService } = authClient;
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: (code: string) => authService.exchangeCodeAndSaveTokens(code),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: AUTH_QUERY_KEYS.all,
        refetchType: 'all',
      });
    },
  });
};
