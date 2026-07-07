import { ErrorCode } from '@aido/errors';
import type { ChangePasswordInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export const useChangePasswordMutationOptions = () => {
  const authService = useAuthService();
  const toast = useAppToast();
  const router = useRouter();

  return mutationOptions({
    mutationFn: async (input: ChangePasswordInput) => {
      const result = await authService.changePassword(input);
      return unwrap(result);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('auth:toasts.passwordChanged'));
      router.back();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.USER_0602)) {
        toast.error(t('auth:toasts.currentPasswordMismatch'));
        return;
      }

      toast.error(error, { fallback: t('auth:toasts.passwordChangeFailed') });
    },
  });
};
