import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useOpenGoogleLoginMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => {
      const result = await authService.openGoogleLogin();
      return unwrap(result);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
