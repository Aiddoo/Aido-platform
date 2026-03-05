import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

import {
  isNotificationError,
  isNotPhysicalDeviceError,
  isPermissionDeniedError,
} from '../../models/notification.error';

const MAX_RETRY_COUNT = 3;

export const useRegisterPushTokenMutationOptions = () => {
  const notificationService = useNotificationService();
  const logger = useLogger();

  return mutationOptions({
    mutationFn: async () => {
      const result = await notificationService.setupPushNotifications();
      return unwrap(result);
    },
    retry: (failureCount, error) => {
      // 재시도하지 않을 에러들
      if (isNotificationError(error)) {
        if (isNotPhysicalDeviceError(error)) return false;
        if (isPermissionDeniedError(error)) return false;
      }

      // 네트워크 에러 등은 최대 3회 재시도
      return failureCount < MAX_RETRY_COUNT;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onError: (error) => {
      if (isNotPhysicalDeviceError(error)) {
        logger.info('[PushNotification] Skipping: not a physical device');
        return;
      }
      if (isPermissionDeniedError(error)) {
        logger.info('[PushNotification] Permission denied by user');
        return;
      }
      logger.error(
        '[PushNotification] Failed to register after retries',
        error instanceof Error ? error : undefined,
      );
    },
  });
};
