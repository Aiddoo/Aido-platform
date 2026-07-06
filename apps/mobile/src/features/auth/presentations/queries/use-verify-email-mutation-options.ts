import type { VerifyEmailInput } from '@aido/validators';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useVerifyEmailMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: VerifyEmailInput) => {
      const result = await authService.verifyEmail(input);
      return unwrap(result);
    },
    onSuccess: () => {
      setStatus('authenticated');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      toast.error(error, { fallback: t('auth:toasts.codeInvalidFormal') });
    },
  });
};
