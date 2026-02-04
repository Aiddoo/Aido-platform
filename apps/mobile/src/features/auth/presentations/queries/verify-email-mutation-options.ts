import type { VerifyEmailInput } from '@aido/validators';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const verifyEmailMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: (input: VerifyEmailInput) => authService.verifyEmail(input),
    onSuccess: () => {
      setStatus('authenticated');
    },
  });
};
