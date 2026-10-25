import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { toError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { mutationOptions } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import {
  isNotificationError,
  isNotPhysicalDeviceError,
  isPermissionDeniedError,
} from '../domains/notification.error';

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
        if (isNotPhysicalDeviceError(error)) {
          return false;
        }
        if (isPermissionDeniedError(error)) {
          return false;
        }
      }

      // 네트워크 에러 등은 최대 3회 재시도
      return failureCount < MAX_RETRY_COUNT;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    onError: (error) => {
      if (isNotPhysicalDeviceError(error)) {
        logger.info(NOTIFICATION_LOG_EVENT.PUSH_REGISTRATION_SKIPPED_NOT_DEVICE);
        return;
      }
      if (isPermissionDeniedError(error)) {
        logger.info(NOTIFICATION_LOG_EVENT.PUSH_PERMISSION_DENIED);
        return;
      }
      logger.error(NOTIFICATION_LOG_EVENT.PUSH_REGISTRATION_FAILED, toError(error));
    },
  });
};
