import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService, useNotificationService } from '@src/bootstrap/providers/di-provider';
import { useMutation } from '@tanstack/react-query';

/**
 * Hook for OAuth code exchange mutation
 */
export const useExchangeCode = () => {
  const authService = useAuthService();
  const notificationService = useNotificationService();
  const { setStatus } = useAuth();

  return useMutation({
    mutationFn: authService.exchangeCode,
    onSuccess: async () => {
      setStatus('authenticated');

      // Register push token after successful authentication
      try {
        await notificationService.setupPushNotifications();
      } catch (error) {
        // Silently fail - push notification is optional
        console.log('[PushNotification] Setup skipped:', error);
      }
    },
  });
};
