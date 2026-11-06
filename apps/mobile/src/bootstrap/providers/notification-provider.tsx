import { subscribeNotificationsChanged } from '@src/core/events/notifications-changed';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useColdStartNotificationResponse } from '@src/features/notification/hooks/use-cold-start-notification-response';
import { useForegroundNotificationSync } from '@src/features/notification/hooks/use-foreground-notification-sync';
import { useMarketingNotificationCategory } from '@src/features/notification/hooks/use-marketing-notification-category';
import { useNativeNotificationListeners } from '@src/features/notification/hooks/use-native-notification-listeners';
import { useNotificationBadgeSync } from '@src/features/notification/hooks/use-notification-badge-sync';
import { useNotificationResponseHandler } from '@src/features/notification/hooks/use-notification-response-handler';
import { useNotificationResponseProcessor } from '@src/features/notification/hooks/use-notification-response-processor';
import { usePushDeviceSync } from '@src/features/notification/hooks/use-push-device-sync';
import { useTimezoneChangeNotice } from '@src/features/notification/hooks/use-timezone-change-notice';
import { invalidateNotifications } from '@src/features/notification/queries/notification-cache';
import type { NotificationType } from '@src/features/notification/schemas/notification.schema';
import { registerForegroundNotificationPresentation } from '@src/shared/infra/notification/expo-push-notification.gateway';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useCallback, useEffect, useReducer } from 'react';

import { useAuth } from './auth-provider';
import { invalidateOnNotificationReceived } from './notification-received-invalidation';

registerForegroundNotificationPresentation();

export function NotificationProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const handleNotificationResponse = useNotificationResponseHandler();
  const queryClient = useQueryClient();
  const invalidateByType = useCallback(
    (type: NotificationType) => invalidateOnNotificationReceived(queryClient, type),
    [queryClient],
  );
  const handleForegroundNotification = useForegroundNotificationSync({
    isAuthenticated,
    invalidateByType,
  });
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const accountId = isAuthenticated ? (me?.id ?? null) : null;
  const { currentTimeZone } = useLocalDate();
  const [reportCount, markReported] = useReducer((count: number) => count + 1, 0);
  const processResponse = useNotificationResponseProcessor({
    accountId,
    authStatus: status,
    handleNotificationResponse,
  });

  useColdStartNotificationResponse({ processResponse });
  useNativeNotificationListeners({ processResponse, handleForegroundNotification });
  useEffect(
    () => subscribeNotificationsChanged(() => invalidateNotifications(queryClient)),
    [queryClient],
  );
  useMarketingNotificationCategory();
  usePushDeviceSync({
    authStatus: status,
    deviceTimeZone: currentTimeZone,
    onReported: markReported,
  });
  useTimezoneChangeNotice({ accountId, reportCount });
  useNotificationBadgeSync(status);

  return children;
}
