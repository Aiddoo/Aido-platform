import type { ForgotPasswordInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useForgotPasswordMutationOptions = () => {
  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: ForgotPasswordInput) => {
      const result = await authService.forgotPassword(input);
      return unwrap(result);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error, { fallback: '요청에 실패했어요. 잠시 후 다시 시도해주세요' });
    },
  });
};
