import { useAuthService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { isAuthError, isCancelledError } from '../../models/auth.error';
import type { OAuthProvider, OAuthProviderSlug } from '../../models/oauth.model';
import { getOAuthProviderLabel } from '../constants/auth-provider-labels.constant';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const useLinkAccountMutationOptions = () => {
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions<{ message: string }, Error, OAuthProviderSlug>({
    mutationFn: async (provider: OAuthProviderSlug) => {
      const result = await authService.linkAccount(provider);
      return unwrap(result);
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
      toast.success(
        t('auth:toasts.accountLinked', {
          provider: getOAuthProviderLabel(provider.toUpperCase() as OAuthProvider),
        }),
      );
      trackEvent('auth_social_linked', { provider });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isCancelledError(error)) return;
      if (isApiError(error) || isAuthError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('auth:toasts.linkFailed') });
    },
  });
};
