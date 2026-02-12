import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import { isAuthError, isCancelledError } from '../../models/auth.error';
import type { OAuthProviderSlug } from '../../models/auth.model';
import { AUTH_PROVIDER_LABELS } from '../constants/auth-provider-labels.constant';
import { AUTH_QUERY_KEYS } from '../constants/auth-query-keys.constant';

export const linkAccountMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();
  const toast = useAppToast();

  return mutationOptions<{ message: string }, Error, OAuthProviderSlug>({
    mutationFn: async (provider: OAuthProviderSlug) => {
      const result = await authService.linkAccount(provider);
      return unwrap(result);
    },
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.linkedAccounts() });
      toast.success(`${AUTH_PROVIDER_LABELS[provider]} 계정이 연결되었습니다`);
    },
    onError: (error) => {
      if (isCancelledError(error)) return;
      if (isApiError(error) || isAuthError(error)) {
        toast.error(error.message);
        return;
      }
      toast.error(undefined, { fallback: '계정 연결에 실패했습니다' });
    },
  });
};
