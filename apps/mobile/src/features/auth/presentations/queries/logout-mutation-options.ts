import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export const logoutMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      setStatus('unauthenticated');
      queryClient.clear();
    },
  });
};
