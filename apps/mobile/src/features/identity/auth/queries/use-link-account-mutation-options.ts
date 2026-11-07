import { useAuthService, useHaptics } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useMutationFailure } from '@src/shared/hooks/use-mutation-failure';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

import { getOAuthProviderLabel } from '../constants/auth-provider-labels';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys';
import { isLoginCancelledError } from '../domains/auth.error';
import { toOAuthProvider } from '../domains/oauth.model';
import { type OAuthProviderSlug } from '../schemas/oauth.schema';

export const useLinkAccountMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();
  const showFailure = useMutationFailure(t('auth:toasts.linkFailed'));

  return mutationOptions<{ message: string }, Error, OAuthProviderSlug>({
    mutationFn: async (provider: OAuthProviderSlug) => {
      const result = await authService.linkAccount(provider);
      return unwrap(result);
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
      toast.success(
        t('auth:toasts.accountLinked', {
          provider: getOAuthProviderLabel(toOAuthProvider(provider)),
        }),
      );
      trackEvent('auth_social_linked', { provider });
    },
    onError: (error) => {
      if (isLoginCancelledError(error)) {
        haptics.notify('error');
        return;
      }
      showFailure(error);
    },
  });
};
