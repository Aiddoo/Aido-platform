import { useNotificationBadgeService } from '@src/bootstrap/providers/di-context';
import type { AuthStatus } from '@src/core/session/auth-status';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useGetUnreadCountQueryOptions } from '../queries/notification.queries';

/**
 * 다른 기기에서 읽거나 받은 알림도 맞도록, 앱이 앞으로 오거나 다시 연결되거나 무효화될 때마다 서버 수로 다시 받는다.
 * 서버가 푸시에 실은 배지는 기기마다 아이콘을 바꿔 캐시와 어긋날 수 있어, 받은 수가 같아도 받을 때마다 다시 맞춘다
 */
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
