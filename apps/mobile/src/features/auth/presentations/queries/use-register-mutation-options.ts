import { ErrorCode } from '@aido/errors';
import type { RegisterInput } from '@aido/validators';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export const useRegisterMutationOptions = () => {
  const replace = useSingleTap(router.replace);

  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: RegisterInput) => {
      const result = await authService.register(input);
      return unwrap(result);
    },
    onSuccess: () => {
      trackEvent('auth_signup', { method: 'email' });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0501)) {
        toast.error(t('auth:toasts.alreadyRegistered'), {
          action: {
            label: t('auth:toasts.goToLogin'),
            onPress: () => {
              replace('/(auth)/email-login');
            },
          },
        });
        return;
      }
      toast.error(error, { fallback: t('auth:toasts.registerFailed') });
    },
  });
};
