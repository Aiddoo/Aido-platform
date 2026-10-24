import type { ChangePasswordInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors';
import { isBusinessError, unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { notifyError, notifySuccess } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';
import { router } from 'expo-router';

export const useChangePasswordMutationOptions = () => {
  const goBack = useSingleTap(router.back);

  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: ChangePasswordInput) => {
      const result = await authService.changePassword(input);
      return unwrap(result);
    },
    onSuccess: () => {
      notifySuccess();
      toast.success(t('auth:toasts.passwordChanged'));
      goBack();
    },
    onError: (error) => {
      if (!isBusinessError(error)) {
        return;
      }

      notifyError();

      if (isApiError(error) && error.hasCode(ErrorCode.USER_0602)) {
        toast.error(t('auth:toasts.currentPasswordMismatch'));
        return;
      }

      toast.error(error, { fallback: t('auth:toasts.passwordChangeFailed') });
    },
  });
};
