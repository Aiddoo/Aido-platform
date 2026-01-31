import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const unregisterPushTokenMutationOptions = () => {
  const notificationService = useNotificationService();

  return mutationOptions({
    mutationFn: notificationService.unregisterPushToken,
    onError: (error) => {
      console.error('[PushNotification] Failed to unregister:', error);
    },
  });
};
