import type { ResendVerificationInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
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
      toast.success(t('auth:toasts.codeResent'));
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      toast.error(error, { fallback: t('auth:toasts.codeResendFailed') });
    },
  });
};
