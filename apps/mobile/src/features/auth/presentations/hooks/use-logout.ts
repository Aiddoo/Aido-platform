import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import type { AuthClient } from '../contexts/auth.context';

export const useLogoutMutationOptions = (authClient: AuthClient) => {
  const { authService } = authClient;
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
};
