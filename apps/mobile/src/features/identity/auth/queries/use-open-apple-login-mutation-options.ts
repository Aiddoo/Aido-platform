import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';

import { useAuthSession } from '../hooks/use-auth-session';

export const useOpenAppleLoginMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { signIn } = useAuthSession();
  const { trackEvent } = useTrack();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async () => {
      const result = await authService.openAppleLogin();
      return unwrap(result);
    },
    onSuccess: (data) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }

      trackEvent(data.isNewUser ? 'auth_signup' : 'auth_login', { method: 'apple' });
    },
    onError: () => {
      haptics.notify('error');
    },
  });
};
