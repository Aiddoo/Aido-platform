import { usePushNotification } from '@src/bootstrap/providers/di-context';
import type {
  ForegroundPushPresentation,
  ReceivedPushNotification,
} from '@src/core/ports/push-notification-gateway';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import { PushNotificationPolicy } from '../domains/notification.model';
import { pushNotificationPayloadSchema } from '../schemas/push-notification-payload.schema';
import {
  isViewingNotificationDestination,
  NOTIFICATION_INBOX_DESTINATION,
  resolveNotificationDestination,
} from '../utils/notification-destination';

/** 앱이 앞에 있을 때 받은 알림을 지금 보고 있는 화면에 맞춰 배너로 보일지 정한다 */
export function useForegroundPushPresentation() {
  const gateway = usePushNotification();
  const queryClient = useQueryClient();
  const windowSizeClass = useWindowSizeClass();
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  const decide = useEffectEvent(
    (notification: ReceivedPushNotification): ForegroundPushPresentation => {
      const payload = pushNotificationPayloadSchema.safeParse(notification.data);
      if (!payload.success) {
        return 'banner';
      }
      const currentRoute = { pathname, params };
      const destination = resolveNotificationDestination(payload.data, {
        shouldOpenToday: true,
        windowSizeClass,
        viewerId: getCachedMe(queryClient)?.id,
      });
      return PushNotificationPolicy.getForegroundPresentation(payload.data, {
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
