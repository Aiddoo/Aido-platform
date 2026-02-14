import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import type { OAuthProvider } from '../../models/auth.model';
import { OAUTH_PROVIDER_LABELS } from '../constants/auth-provider-labels.constant';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const unlinkAccountMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions<{ message: string }, Error, OAuthProvider>({
    mutationFn: async (provider: OAuthProvider) => {
      const result = await authService.unlinkAccount(provider);
      return unwrap(result);
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
      toast.success(`${OAUTH_PROVIDER_LABELS[provider]} 계정 연결이 해제되었습니다`);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '연결 해제에 실패했습니다' });
    },
  });
};
