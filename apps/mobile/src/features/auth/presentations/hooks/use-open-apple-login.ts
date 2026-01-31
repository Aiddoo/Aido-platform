import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useMutation } from '@tanstack/react-query';

/**
 * Hook for opening Apple login
 */
export const useOpenAppleLogin = () => {
  const authService = useAuthService();

  return useMutation({
    mutationFn: () => authService.openAppleLogin(),
  });
};
