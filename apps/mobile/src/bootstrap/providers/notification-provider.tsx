import { subscribeNotificationsChanged } from '@src/core/events/notifications-changed';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import type { NotificationType } from '@src/features/notification/domains/notification.model';
import { useForegroundPushPresentation } from '@src/features/notification/hooks/use-foreground-push-presentation';
import { useForegroundPushSync } from '@src/features/notification/hooks/use-foreground-push-sync';
import { useNotificationBadgeSync } from '@src/features/notification/hooks/use-notification-badge-sync';
import { usePushDeviceReleaseFlush } from '@src/features/notification/hooks/use-push-device-release-flush';
import { usePushDeviceSync } from '@src/features/notification/hooks/use-push-device-sync';
import { useRegisterMarketingNotificationCategory } from '@src/features/notification/hooks/use-register-marketing-notification-category';
import { useTimezoneChangeNotice } from '@src/features/notification/hooks/use-timezone-change-notice';
import { invalidateNotifications } from '@src/features/notification/queries/notification-cache';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useCallback, useEffect, useReducer } from 'react';

import { invalidateOnNotificationReceived } from '../query/notification-received-invalidation';

export function NotificationProvider({ children }: PropsWithChildren) {
  const status = useAuthStatus();
  const isAuthenticated = status === 'authenticated';
  const queryClient = useQueryClient();
  const invalidateByType = useCallback(
    (type: NotificationType) => invalidateOnNotificationReceived(queryClient, type),
    [queryClient],
  );
  const { data: me } = useQuery({ ...useGetMeQueryOptions(), enabled: isAuthenticated });
  const accountId = isAuthenticated ? (me?.id ?? null) : null;
  const { currentTimeZone } = useLocalDate();
  const [reportCount, markReported] = useReducer((count: number) => count + 1, 0);

  useForegroundPushPresentation();
  useForegroundPushSync({ authStatus: status, invalidateByType });
  useEffect(
    () => subscribeNotificationsChanged(() => invalidateNotifications(queryClient)),
    [queryClient],
  );
  useRegisterMarketingNotificationCategory();
  usePushDeviceSync({
    authStatus: status,
    deviceTimeZone: currentTimeZone,
    onReported: markReported,
  });
  usePushDeviceReleaseFlush(status);
  useTimezoneChangeNotice({ accountId, reportCount });
  useNotificationBadgeSync(status);

  return children;
}
