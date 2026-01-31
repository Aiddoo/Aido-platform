import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const emailLoginMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.emailLogin(email, password),
    onSuccess: () => {
      setStatus('authenticated');
    },
  });
};
