import type { RegisterInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import { router } from 'expo-router';

export const useRegisterMutationOptions = () => {
  const haptics = useHaptics();
  const replace = useSingleTap(router.replace);

  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (input: RegisterInput) => {
      const result = await authService.register(input);
      return unwrap(result);
    },
    onSuccess: ({ isEmailSent }) => {
      trackEvent('auth_signup', { method: 'email' });
      // 가입은 됐다. 코드 입력 단계의 재발송으로 다시 받게 알린다
      if (!isEmailSent) {
        toast.warning(t('auth:toasts.verificationEmailNotSent'));
      }
    },
    onError: (error) => {
      haptics.notify('error');

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
