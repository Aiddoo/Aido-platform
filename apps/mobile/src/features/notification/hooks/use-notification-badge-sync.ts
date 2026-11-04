import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useEffect } from 'react';

import type { NotificationAuthStatus } from '../utils/navigation/notification-response-disposition';
import { syncNotificationBadge } from '../utils/sync-notification-badge';

export function useNotificationBadgeSync(authStatus: NotificationAuthStatus) {
  const notificationService = useNotificationService();
  const logger = useLogger();
  const isOnline = useIsOnline();

  useEffect(() => {
    syncNotificationBadge({ authStatus, isOnline, notificationService, logger });
  }, [authStatus, isOnline, logger, notificationService]);
}
