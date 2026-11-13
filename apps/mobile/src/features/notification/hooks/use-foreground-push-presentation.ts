import { useLogger, usePushNotification } from '@src/bootstrap/providers/di-context';
import type {
  ForegroundPushPresentation,
  ReceivedPushNotification,
} from '@src/core/ports/push-notification-gateway';
import { useFocusedRouteParams } from '@src/shared/navigation/use-focused-route-params';
import { usePathname } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import { parsePushNotification } from '../apis/push-notification.mapper';
import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { getForegroundPushPresentation } from '../utils/foreground-push-presentation.view-model';
import {
  isViewingNotificationDestination,
  NOTIFICATION_INBOX_DESTINATION,
} from '../utils/notification-destination.view-model';
import { useResolveNotificationDestination } from './use-notification-destination';

/** 앱이 앞에 있을 때 받은 알림을 지금 보고 있는 화면에 맞춰 배너로 보일지 정한다 */
export function useForegroundPushPresentation() {
  const gateway = usePushNotification();
  const logger = useLogger();
  const resolveDestination = useResolveNotificationDestination();
  const pathname = usePathname();
  const params = useFocusedRouteParams();

  const decide = useEffectEvent(
    (notification: ReceivedPushNotification): ForegroundPushPresentation => {
      const { notification: pushNotification, droppedPaths } = parsePushNotification(
        notification.data,
      );
      if (droppedPaths.length > 0) {
        logger.warn(NOTIFICATION_LOG_EVENT.PUSH_PAYLOAD_DROPPED, {
          source: 'foreground',
          droppedPaths: droppedPaths.join(','),
          isReadable: pushNotification != null,
        });
      }
      if (pushNotification == null) {
        return 'banner';
      }
      const currentRoute = { pathname, params };
      const destination = resolveDestination(pushNotification.target);
      return getForegroundPushPresentation(pushNotification, {
        isViewingInbox: isViewingNotificationDestination(
          NOTIFICATION_INBOX_DESTINATION,
          currentRoute,
        ),
        isViewingDestination: isViewingNotificationDestination(destination, currentRoute),
      });
    },
  );

  useEffect(
    () => gateway.setForegroundPresentation((notification) => decide(notification)),
    [gateway],
  );
}
