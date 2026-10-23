import { useAuthService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { getOAuthProviderLabel } from '../constants/auth-provider-labels';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys';
import type { OAuthProvider, OAuthProviderSlug } from '../domains/oauth.model';

export const useUnlinkAccountMutationOptions = () => {
  const authService = useAuthService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions<{ message: string }, Error, OAuthProvider>({
    mutationFn: async (provider: OAuthProvider) => {
      const result = await authService.unlinkAccount(provider);
      return unwrap(result);
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
      toast.success(
        t('auth:toasts.accountUnlinked', { provider: getOAuthProviderLabel(provider) }),
      );
      trackEvent('auth_social_unlinked', {
        provider: provider.toLowerCase() as OAuthProviderSlug,
      });
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: t('auth:toasts.unlinkFailed') });
    },
  });
};
