import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { notifyError } from '@src/shared/utils/haptics';
import { mutationOptions } from '@tanstack/react-query';

import type { OAuthProviderSlug } from '../domains/oauth.model';

export const useExchangeCodeMutationOptions = () => {
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

      trackEvent('auth_login', { method: variables.provider });
    },
    onError: () => {
      notifyError();
    },
  });
};
