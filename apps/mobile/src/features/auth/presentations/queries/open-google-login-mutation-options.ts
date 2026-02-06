import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const openGoogleLoginMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => {
      const result = await authService.openGoogleLogin();
      return unwrap(result);
    },
  });
};
