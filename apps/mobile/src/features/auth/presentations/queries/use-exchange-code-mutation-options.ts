import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import type { OAuthProviderSlug } from '../../models/oauth.model';

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
