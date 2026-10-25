import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';

export const useOpenKakaoLoginMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => {
      const result = await authService.openKakaoLogin();
      return unwrap(result);
    },
    onError: () => {
      notifyError();
    },
  });
};
