import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useMutation } from '@tanstack/react-query';

/**
 * Hook for email login mutation
 */
export const useEmailLogin = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.emailLogin(email, password),
    onSuccess: () => {
      setStatus('authenticated');
    },
  });
};
