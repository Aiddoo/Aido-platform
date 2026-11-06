import type { DeleteAccountInput } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useAuthService,
  useHaptics,
  useSessionCleanupService,
} from '@src/bootstrap/providers/di-context';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { t } from '@src/shared/i18n';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export const useDeleteAccountMutationOptions = () => {
  const haptics = useHaptics();
  const authService = useAuthService();
  const analytics = useAnalytics();
  const { trackEvent } = useTrack();
  const toast = useAppToast();
  const { setStatus } = useAuth();
  const queryClient = useQueryClient();
  const sessionCleanupService = useSessionCleanupService();

  return mutationOptions({
    // 푸시 기기는 서버 탈퇴가 전 세션과 함께 푼다. 먼저 풀면 비밀번호 오류에도 알림이 끊긴다
    mutationFn: async (input: DeleteAccountInput) => {
      const result = await authService.deleteAccount(input);
      return unwrap(result);
    },
    onSuccess: () => {
      haptics.notify('success');
      toast.success(t('auth:toasts.accountDeleted'));
      trackEvent('auth_account_deleted');
      analytics.resetData();
      const accountId = getCachedMe(queryClient)?.id;
      if (accountId != null) {
        sessionCleanupService.afterAccountDeleted(accountId);
      }
    },
    onError: (error) => {
      haptics.notify('error');

      if (isApiError(error) && error.hasCode(ErrorCode.USER_0602)) {
        toast.error(t('auth:toasts.passwordMismatch'));
        return;
      }

      toast.error(error, { fallback: t('auth:toasts.deleteAccountFailed') });
    },
    // 캐시 정리는 상태 소유자(AuthProvider)가 미인증 전환 후에 수행한다.
    onSettled: (_data, error) => {
      if (!error) {
        setStatus('unauthenticated');
      }
    },
  });
};
