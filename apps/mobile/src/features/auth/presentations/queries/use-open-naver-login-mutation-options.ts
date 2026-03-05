import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useOpenNaverLoginMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => {
      const result = await authService.openNaverLogin();
      return unwrap(result);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
