import { subscribeNotificationsChanged } from '@src/core/events/notifications-changed';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import type { NotificationType } from '@src/features/notification/domains/notification.model';
import { useForegroundPushPresentation } from '@src/features/notification/hooks/use-foreground-push-presentation';
import { useForegroundPushSync } from '@src/features/notification/hooks/use-foreground-push-sync';
import { useNotificationBadgeSync } from '@src/features/notification/hooks/use-notification-badge-sync';
import { usePushDeviceSync } from '@src/features/notification/hooks/use-push-device-sync';
import { useRegisterMarketingNotificationCategory } from '@src/features/notification/hooks/use-register-marketing-notification-category';
import { useTimezoneChangeNotice } from '@src/features/notification/hooks/use-timezone-change-notice';
import { invalidateNotifications } from '@src/features/notification/queries/notification-cache';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useQueryClient } from '@tanstack/react-query';
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
  const accountId = useMyAccountId({ isEnabled: isAuthenticated });
  const { currentTimeZone } = useLocalDate();
  const [reportCount, markReported] = useReducer((count: number) => count + 1, 0);

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
  useTimezoneChangeNotice({ accountId, reportCount });
  useNotificationBadgeSync({ authStatus: status });

  return (
    <>
      <ForegroundPushPresentation />
      {children}
    </>
  );
}

/** 지금 경로와 params를 읽어 URL이 바뀔 때마다 다시 그려지므로 Provider와 나눈 null 자식이다 */
function ForegroundPushPresentation() {
  useForegroundPushPresentation();

  return null;
}
