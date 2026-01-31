import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { useMutation } from '@tanstack/react-query';

/**
 * Hook for opening Kakao login
 */
export const useOpenKakaoLogin = () => {
  const authService = useAuthService();

  return useMutation({
    mutationFn: () => authService.openKakaoLogin(),
  });
};
