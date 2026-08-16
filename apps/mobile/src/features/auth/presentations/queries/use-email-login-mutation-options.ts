import { ErrorCode } from '@aido/errors';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
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

export const useEmailLoginMutationOptions = () => {
  const push = useSingleTap(router.push);

  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const { setStatus } = useAuth();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await authService.emailLogin(email, password);
      return unwrap(result);
    },
    onSuccess: (data) => {
      setStatus('authenticated');
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }
      trackEvent('auth_login', { method: 'email' });
    },
    onError: (error, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.EMAIL_0503)) {
        push({ pathname: '/(auth)/verify-email', params: { email: variables.email } });
        return;
      }

      toast.error(error, { fallback: t('auth:toasts.loginFailed') });
    },
  });
};
