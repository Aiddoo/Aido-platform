import { useNotificationService } from '@src/bootstrap/providers/di-context';
import type { NotificationService } from '@src/features/notification/apis/notification.service';
import { queryOptions } from '@tanstack/react-query';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';

export function getNotificationPermissionQueryOptions(notificationService: NotificationService) {
  return queryOptions({
    queryKey: NOTIFICATION_QUERY_KEYS.permission(),
    queryFn: () => notificationService.hasPermission(),
    // 설정 앱에서 바꾸고 돌아올 수 있어 화면을 열 때마다 다시 본다
    staleTime: 0,
  });
}

export function useGetNotificationPermissionQueryOptions() {
  return getNotificationPermissionQueryOptions(useNotificationService());
}
