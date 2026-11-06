import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useEffect } from 'react';

import { syncNotificationBadge } from '../utils/sync-notification-badge';

export function useNotificationBadgeSync(authStatus: AuthStatus) {
  const notificationService = useNotificationService();
  const logger = useLogger();
  const isOnline = useIsOnline();

  useEffect(() => {
    syncNotificationBadge({ authStatus, isOnline, notificationService, logger });
  }, [authStatus, isOnline, logger, notificationService]);
}
