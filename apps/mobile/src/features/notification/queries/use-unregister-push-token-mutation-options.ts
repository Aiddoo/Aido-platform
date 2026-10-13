import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

export const useUnregisterPushTokenMutationOptions = () => {
  const notificationService = useNotificationService();
  const logger = useLogger();

  return mutationOptions({
    mutationFn: async () => {
      const result = await notificationService.unregisterPushToken();
      return unwrap(result);
    },
    onError: (error) => {
      logger.error('[PushNotification] Failed to unregister', toError(error));
    },
  });
};
