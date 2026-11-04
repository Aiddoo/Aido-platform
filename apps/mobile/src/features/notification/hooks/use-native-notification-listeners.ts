import { useLogger, usePushNotificationGateway } from '@src/bootstrap/providers/di-context';
import type {
  PushNotificationResponse,
  ReceivedPushNotification,
} from '@src/core/ports/push-notification-gateway';
import { useEffect } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';

export function useNativeNotificationListeners({
  processResponse,
  handleForegroundNotification,
}: {
  processResponse: (response: PushNotificationResponse) => void;
  handleForegroundNotification: (notification?: ReceivedPushNotification) => void;
}) {
  const logger = useLogger();
  const gateway = usePushNotificationGateway();

  useEffect(() => {
    const unsubscribeReceived = gateway.addReceivedListener((notification) => {
      logger.info(NOTIFICATION_LOG_EVENT.FOREGROUND_RECEIVED);
      handleForegroundNotification(notification);
    });
    const unsubscribeResponse = gateway.addResponseListener(processResponse);

    return () => {
      unsubscribeReceived();
      unsubscribeResponse();
    };
  }, [gateway, handleForegroundNotification, logger, processResponse]);
}
