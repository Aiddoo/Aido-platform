import { useNotificationBadgeService } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useEffect } from 'react';

export function useNotificationBadgeSync(authStatus: AuthStatus) {
  const notificationBadgeService = useNotificationBadgeService();
  const isOnline = useIsOnline();

  useEffect(() => {
    notificationBadgeService.syncBadge({ authStatus, isOnline });
  }, [authStatus, isOnline, notificationBadgeService]);
}
