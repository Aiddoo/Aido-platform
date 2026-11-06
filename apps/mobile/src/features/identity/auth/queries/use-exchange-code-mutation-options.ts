import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';

import type { OAuthProviderSlug } from '../schemas/oauth.schema';

export const useExchangeCodeMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const { setStatus } = useAuth();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (
      request: Parameters<typeof authService.exchangeCode>[0] & { provider: OAuthProviderSlug },
    ) => {
      const result = await authService.exchangeCode(request);
      return unwrap(result);
    },
    onSuccess: (data, variables) => {
      setStatus('authenticated');
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
