import { useMutation } from '@tanstack/react-query';
import { useAuthService } from '../providers/auth.provider';

export const useOpenKakaoLogin = () => {
  const authService = useAuthService();

  return useMutation({
    mutationFn: () => authService.openKakaoLogin(),
  });
};
