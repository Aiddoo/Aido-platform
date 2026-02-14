import { useAuth } from '@src/bootstrap/providers/auth-provider';
import {
  useAuthService,
  useLogger,
  useNotificationService,
} from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const exchangeCodeMutationOptions = () => {
  const authService = useAuthService();
  const notificationService = useNotificationService();
  const logger = useLogger();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: async (request: Parameters<typeof authService.exchangeCode>[0]) => {
      const result = await authService.exchangeCode(request);
      return unwrap(result);
    },
    onSuccess: async () => {
      setStatus('authenticated');

      // Register push token after successful authentication
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
  });
};
