import type { ResendVerificationInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useResendVerificationMutationOptions = () => {
  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: ResendVerificationInput) => {
      const result = await authService.resendVerification(input);
      return unwrap(result);
    },
    onSuccess: () => {
      toast.success('인증 코드가 재발송되었습니다');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      toast.error(error, { fallback: '인증 코드 재발송에 실패했습니다' });
    },
  });
};
