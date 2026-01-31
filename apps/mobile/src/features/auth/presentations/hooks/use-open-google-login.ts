import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useMutation } from '@tanstack/react-query';

/**
 * Hook for opening Google login
 */
export const useOpenGoogleLogin = () => {
  const authService = useAuthService();

  return useMutation({
    mutationFn: () => authService.openGoogleLogin(),
  });
};
