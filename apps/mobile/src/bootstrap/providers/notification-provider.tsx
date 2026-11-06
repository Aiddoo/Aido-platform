import { useGetMeQueryOptions } from '@src/features/identity/user/queries/get-me-query-options';
import { useColdStartNotificationResponse } from '@src/features/notification/hooks/use-cold-start-notification-response';
import { useForegroundNotificationSync } from '@src/features/notification/hooks/use-foreground-notification-sync';
import { useMarketingNotificationCategory } from '@src/features/notification/hooks/use-marketing-notification-category';
import { useNativeNotificationListeners } from '@src/features/notification/hooks/use-native-notification-listeners';
import { useNotificationBadgeSync } from '@src/features/notification/hooks/use-notification-badge-sync';
import { useNotificationResponseHandler } from '@src/features/notification/hooks/use-notification-response-handler';
import { useNotificationResponseProcessor } from '@src/features/notification/hooks/use-notification-response-processor';
import { usePushDeviceSync } from '@src/features/notification/hooks/use-push-device-sync';
import { useTimezoneChangeNotice } from '@src/features/notification/hooks/use-timezone-change-notice';
import { registerForegroundNotificationPresentation } from '@src/shared/infra/notification/expo-push-notification.gateway';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useQuery } from '@tanstack/react-query';
import { type PropsWithChildren, useReducer } from 'react';

import { useAuth } from './auth-provider';

registerForegroundNotificationPresentation();

export function NotificationProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const handleNotificationResponse = useNotificationResponseHandler();
  const handleForegroundNotification = useForegroundNotificationSync({ isAuthenticated });
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
