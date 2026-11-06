import type { ChangePasswordInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors';
import { isBusinessError, unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import { router } from 'expo-router';

export const useChangePasswordMutationOptions = () => {
  const haptics = useHaptics();
  const goBack = useSingleTap(router.back);

  const authService = useAuthService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: ChangePasswordInput) => {
      const result = await authService.changePassword(input);
      return unwrap(result);
    },
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('auth:toasts.passwordChanged'));
      goBack();
    },
    onError: (error) => {
      if (!isBusinessError(error)) {
        return;
      }

      haptics.notify('error');

      if (isApiError(error) && error.hasCode(ErrorCode.USER_0602)) {
        toast.error(t('auth:toasts.currentPasswordMismatch'));
        return;
      }

      toast.error(error, { fallback: t('auth:toasts.passwordChangeFailed') });
    },
  });
};
