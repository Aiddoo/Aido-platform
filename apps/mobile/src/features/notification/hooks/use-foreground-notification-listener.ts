import { useLogger, usePushNotificationGateway } from '@src/bootstrap/providers/di-context';
import type { ReceivedPushNotification } from '@src/core/ports/push-notification-gateway';
import { useEffect } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';

export function useForegroundNotificationListener(
  handleForegroundNotification: (notification?: ReceivedPushNotification) => void,
) {
  const logger = useLogger();
  const gateway = usePushNotificationGateway();

  useEffect(
    () =>
      gateway.addReceivedListener((notification) => {
        logger.info(NOTIFICATION_LOG_EVENT.FOREGROUND_RECEIVED);
        handleForegroundNotification(notification);
      }),
    [gateway, handleForegroundNotification, logger],
  );
}
