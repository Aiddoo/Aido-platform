import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAuthService,
  useLogger,
  useNotificationService,
} from '@src/bootstrap/providers/di-provider';
import { resetAuthClient } from '@src/shared/infra/http/auth-client';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const logoutMutationOptions = () => {
  const authService = useAuthService();
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
  const logger = useLogger();

  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: async () => {
      try {
        const unregisterResult = await notificationService.unregisterPushToken();
        if (!unregisterResult.ok) {
          logger.warn('[PushNotification] Unregister skipped', {
            error: unregisterResult.error,
          });
        }
      } catch (error) {
        // Silently fail - continue with logout
        logger.warn('[PushNotification] Unregister error', { error });
      }

      const result = await authService.logout();
      if (!result.ok) {
        logger.warn('[Logout] API failed', { error: result.error });
      }
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    // API 성공/실패 관계없이 항상 로그아웃 처리
    onSettled: () => {
      setStatus('unauthenticated');
      queryClient.clear();
      resetAuthClient();
    },
  });
};
