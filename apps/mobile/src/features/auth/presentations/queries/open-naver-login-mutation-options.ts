import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const openNaverLoginMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: () => authService.openNaverLogin(),
  });
};
