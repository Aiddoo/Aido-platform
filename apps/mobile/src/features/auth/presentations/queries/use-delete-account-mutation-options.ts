import { ErrorCode } from '@aido/errors';
import type { DeleteAccountInput } from '@aido/validators';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useAuthService,
  useLogger,
  useNotificationService,
} from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { t } from '@src/shared/i18n';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useDeleteAccountMutationOptions = () => {
  const authService = useAuthService();
  const analytics = useAnalytics();
  const { trackEvent } = useTrack();
  const notificationService = useNotificationService();
  const toast = useAppToast();
  const logger = useLogger();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: async (input: DeleteAccountInput) => {
      try {
        const unregisterResult = await notificationService.unregisterPushToken();
        if (!unregisterResult.ok) {
          logger.warn('[PushNotification] Unregister skipped', {
            error: unregisterResult.error,
          });
        }
      } catch (error) {
        logger.warn('[PushNotification] Unregister error', { error });
      }

      const result = await authService.deleteAccount(input);
      return unwrap(result);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('auth:toasts.accountDeleted'));
      trackEvent('auth_account_deleted');
      analytics.resetData();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

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
