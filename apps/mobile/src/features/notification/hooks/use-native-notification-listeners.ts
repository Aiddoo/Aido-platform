import { useLogger } from '@src/bootstrap/providers/di-context';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';

export function useNativeNotificationListeners({
  processResponse,
  handleForegroundNotification,
}: {
  processResponse: (response: Notifications.NotificationResponse) => void;
  handleForegroundNotification: (notification?: Notifications.Notification) => void;
}) {
  const logger = useLogger();

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      logger.info(NOTIFICATION_LOG_EVENT.FOREGROUND_RECEIVED);
      handleForegroundNotification(notification);
    });
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(processResponse);

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [handleForegroundNotification, logger, processResponse]);
}
