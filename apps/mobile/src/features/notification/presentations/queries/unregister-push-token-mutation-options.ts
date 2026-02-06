import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const unregisterPushTokenMutationOptions = () => {
  const notificationService = useNotificationService();

  return mutationOptions({
    mutationFn: async () => {
      const result = await notificationService.unregisterPushToken();
      return unwrap(result);
    },
    onError: (error) => {
      console.error('[PushNotification] Failed to unregister:', error);
    },
  });
};
