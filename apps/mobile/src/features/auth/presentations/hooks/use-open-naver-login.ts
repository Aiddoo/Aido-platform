import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useMutation } from '@tanstack/react-query';

/**
 * Hook for opening Naver login
 */
export const useOpenNaverLogin = () => {
  const authService = useAuthService();

  return useMutation({
    mutationFn: () => authService.openNaverLogin(),
  });
};
