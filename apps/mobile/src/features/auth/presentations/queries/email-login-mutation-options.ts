import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const emailLoginMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await authService.emailLogin(email, password);
      return unwrap(result);
    },
    onSuccess: () => {
      setStatus('authenticated');
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
