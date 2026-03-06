import { ErrorCode } from '@aido/errors';
import type { DeleteAccountInput } from '@aido/validators';
import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAnalytics,
  useAuthService,
  useLogger,
  useNotificationService,
} from '@src/bootstrap/providers/di-provider';
import { track } from '@src/shared/analytics';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { resetAuthClient } from '@src/shared/infra/http/auth-client';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useDeleteAccountMutationOptions = () => {
  const authService = useAuthService();
  const analytics = useAnalytics();
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
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
      toast.success('계정이 탈퇴 처리되었어요');
      track(analytics, 'auth_account_deleted');
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.USER_0602)) {
        toast.error('비밀번호가 일치하지 않아요');
        return;
      }

      toast.error(error, { fallback: '회원 탈퇴에 실패했어요' });
    },
    onSettled: (_data, error) => {
      if (!error) {
        setStatus('unauthenticated');
        queryClient.clear();
        resetAuthClient();
      }
    },
  });
};
