import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

import {
  NotificationNotPhysicalDeviceError,
  NotificationPermissionDeniedError,
} from '../../models/notification.error';

const MAX_RETRY_COUNT = 3;

export const registerPushTokenMutationOptions = () => {
  const notificationService = useNotificationService();

  return mutationOptions({
    mutationFn: notificationService.setupPushNotifications,
    retry: (failureCount, error) => {
      // 재시도하지 않을 에러들
      if (error instanceof NotificationNotPhysicalDeviceError) return false;
      if (error instanceof NotificationPermissionDeniedError) return false;

      // 네트워크 에러 등은 최대 3회 재시도
      return failureCount < MAX_RETRY_COUNT;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onError: (error) => {
      if (error instanceof NotificationNotPhysicalDeviceError) {
        console.log('[PushNotification] Skipping: not a physical device');
        return;
      }
      if (error instanceof NotificationPermissionDeniedError) {
        console.log('[PushNotification] Permission denied by user');
        return;
      }
      console.error('[PushNotification] Failed to register after retries:', error);
    },
  });
};
