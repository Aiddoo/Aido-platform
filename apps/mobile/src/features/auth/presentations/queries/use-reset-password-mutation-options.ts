import { ErrorCode } from '@aido/errors';
import type { ResetPasswordInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export const useResetPasswordMutationOptions = () => {
  const authService = useAuthService();
  const toast = useAppToast();
  const router = useRouter();

  return mutationOptions({
    mutationFn: async (input: ResetPasswordInput) => {
      const result = await authService.resetPassword(input);
      return unwrap(result);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('auth:toasts.passwordResetDone'));
      router.replace('/(auth)/email-login');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        if (error.hasCode(ErrorCode.VERIFY_0751)) {
          toast.error(t('auth:toasts.codeInvalid'));
          return;
        }
        if (error.hasCode(ErrorCode.VERIFY_0752)) {
          toast.error(t('auth:toasts.codeExpired'));
          return;
        }
        if (error.hasCode(ErrorCode.VERIFY_0754)) {
          toast.error(t('auth:toasts.codeAttemptsExceeded'));
          return;
        }
      }

      toast.error(error, { fallback: t('auth:toasts.passwordResetFailed') });
    },
  });
};
