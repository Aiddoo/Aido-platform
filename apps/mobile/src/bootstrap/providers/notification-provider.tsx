import { useColdStartNotificationResponse } from '@src/features/notification/hooks/use-cold-start-notification-response';
import { useForegroundNotificationSync } from '@src/features/notification/hooks/use-foreground-notification-sync';
import { useMarketingNotificationCategory } from '@src/features/notification/hooks/use-marketing-notification-category';
import { useNativeNotificationListeners } from '@src/features/notification/hooks/use-native-notification-listeners';
import { useNotificationBadgeSync } from '@src/features/notification/hooks/use-notification-badge-sync';
import { useNotificationResponseHandler } from '@src/features/notification/hooks/use-notification-response-handler';
import { useNotificationResponseProcessor } from '@src/features/notification/hooks/use-notification-response-processor';
import { usePushDeviceSync } from '@src/features/notification/hooks/use-push-device-sync';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth-provider';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function NativeNotificationProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const isAuthenticated = status === 'authenticated';
  const handleNotificationResponse = useNotificationResponseHandler();
  const handleForegroundNotification = useForegroundNotificationSync({ isAuthenticated });
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const processResponse = useNotificationResponseProcessor({
    accountId: isAuthenticated ? (me?.id ?? null) : null,
    authStatus: status,
    handleNotificationResponse,
  });

  useColdStartNotificationResponse({ processResponse });
  useNativeNotificationListeners({ processResponse, handleForegroundNotification });
  useMarketingNotificationCategory();
  usePushDeviceSync({ authStatus: status });
  useNotificationBadgeSync(status);

  return children;
}

// 웹은 푸시 기기가 아니어서 권한·토큰·배지를 다루지 않는다
function WebNotificationProvider({ children }: PropsWithChildren) {
  return children;
}

export const NotificationProvider =
  Platform.OS === 'web' ? WebNotificationProvider : NativeNotificationProvider;
