import { useNotificationBadgeService } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useGetUnreadCountQueryOptions } from '../queries/notification.queries';

/** 푸시에 실린 배지는 기기마다 아이콘을 바꿔 캐시와 어긋날 수 있어, 받은 수가 같아도 받을 때마다 다시 맞춘다 */
export function useNotificationBadgeSync({ authStatus }: { authStatus: AuthStatus }) {
  const notificationBadgeService = useNotificationBadgeService();
  const { data: unreadCount, dataUpdatedAt } = useQuery({
    ...useGetUnreadCountQueryOptions(),
    enabled: authStatus === 'authenticated',
  });

  useEffect(() => {
    notificationBadgeService.syncBadge({ authStatus, unreadCount });
  }, [authStatus, notificationBadgeService, unreadCount, dataUpdatedAt]);
}
