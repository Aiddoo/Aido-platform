import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const openKakaoLoginMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: () => authService.openKakaoLogin(),
  });
};
