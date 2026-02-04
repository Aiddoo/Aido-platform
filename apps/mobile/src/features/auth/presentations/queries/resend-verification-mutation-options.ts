import type { ResendVerificationInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const resendVerificationMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: (input: ResendVerificationInput) => authService.resendVerification(input),
  });
};
