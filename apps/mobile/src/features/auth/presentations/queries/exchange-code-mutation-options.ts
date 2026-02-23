import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAuthService,
  useLogger,
  useNotificationService,
} from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const exchangeCodeMutationOptions = () => {
  const authService = useAuthService();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const { setStatus } = useAuth();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (request: Parameters<typeof authService.exchangeCode>[0]) => {
      const result = await authService.exchangeCode(request);
      return unwrap(result);
    },
    onSuccess: async (data) => {
      setStatus('authenticated');
      if (data.accountRestored) {
        toast.success('탈퇴한 계정이 복구되었어요');
      }

      try {
        const tokenResult = await notificationService.setupPushNotifications();
        if (!tokenResult.ok) {
          logger.warn('[PushNotification] Setup skipped', { error: tokenResult.error });
        }
      } catch (error) {
        // Silently fail - push notification is optional
        logger.warn('[PushNotification] Setup error', { error });
      }
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });
};
