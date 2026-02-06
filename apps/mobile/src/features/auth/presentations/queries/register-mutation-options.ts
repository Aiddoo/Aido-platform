import type { RegisterInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const registerMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async (input: RegisterInput) => {
      const result = await authService.register(input);
      return unwrap(result);
    },
  });
};
