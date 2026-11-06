import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const useOpenKakaoLoginMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => {
      const result = await authService.openKakaoLogin();
      return unwrap(result);
    },
    onError: () => {
      haptics.notify('error');
    },
  });
};
