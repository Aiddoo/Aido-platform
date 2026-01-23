import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const exchangeCodeMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: authService.exchangeCode,
    onSuccess: () => {
      setStatus('authenticated');
    },
  });
};
