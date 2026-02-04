import type { RegisterInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const registerMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: (input: RegisterInput) => authService.register(input),
  });
};
