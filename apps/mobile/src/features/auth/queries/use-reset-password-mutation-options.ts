import type { ResetPasswordInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';
import { router } from 'expo-router';

export const useResetPasswordMutationOptions = () => {
  const replace = useSingleTap(router.replace);

  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: ResetPasswordInput) => {
      const result = await authService.resetPassword(input);
      return unwrap(result);
    },
    onSuccess: () => {
      notifySuccess();
      toast.success(t('auth:toasts.passwordResetDone'));
      replace('/(auth)/email-login');
    },
    onError: (error) => {
      notifyError();

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
