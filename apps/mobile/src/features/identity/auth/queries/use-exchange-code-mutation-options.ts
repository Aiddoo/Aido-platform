import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';

import { useAuthSession } from '../hooks/use-auth-session';
import type { OAuthProviderSlug } from '../schemas/oauth.schema';

export const useExchangeCodeMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const { signIn } = useAuthSession();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (
      request: Parameters<typeof authService.exchangeCode>[0] & { provider: OAuthProviderSlug },
    ) => {
      const result = await authService.exchangeCode(request);
      return unwrap(result);
    },
    onSuccess: (data, variables) => {
      signIn();
      if (data.accountRestored) {
        toast.success(t('auth:toasts.accountRestored'));
      }

      trackEvent(data.isNewUser ? 'auth_signup' : 'auth_login', { method: variables.provider });
    },
    onError: () => {
      haptics.notify('error');
    },
  });
};
