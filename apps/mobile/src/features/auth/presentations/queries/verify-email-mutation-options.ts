import type { VerifyEmailInput } from '@aido/validators';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';

export const verifyEmailMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: VerifyEmailInput) => {
      const result = await authService.verifyEmail(input);
      return unwrap(result);
    },
    onSuccess: () => {
      setStatus('authenticated');
    },
    onError: (error) => {
      toast.error(error, { fallback: '인증 코드가 올바르지 않습니다' });
    },
  });
};
