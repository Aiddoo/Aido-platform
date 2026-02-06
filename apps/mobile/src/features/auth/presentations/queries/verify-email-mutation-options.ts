import type { VerifyEmailInput } from '@aido/validators';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const verifyEmailMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: async (input: VerifyEmailInput) => {
      const result = await authService.verifyEmail(input);
      return unwrap(result);
    },
    onSuccess: () => {
      setStatus('authenticated');
    },
  });
};
