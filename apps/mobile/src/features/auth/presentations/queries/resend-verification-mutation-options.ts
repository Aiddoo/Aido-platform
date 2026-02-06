import type { ResendVerificationInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const resendVerificationMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async (input: ResendVerificationInput) => {
      const result = await authService.resendVerification(input);
      return unwrap(result);
    },
  });
};
