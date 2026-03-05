import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useOpenKakaoLoginMutationOptions = () => {
  const authService = useAuthService();

  return mutationOptions({
    mutationFn: async () => {
      const result = await authService.openKakaoLogin();
      return unwrap(result);
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
