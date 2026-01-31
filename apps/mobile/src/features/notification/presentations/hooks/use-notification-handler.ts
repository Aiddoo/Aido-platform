import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { notificationQueryKeys } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import type * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback } from 'react';

interface NotificationData {
  notificationId?: number;
  type?: string;
  route?: string | null;
  metadata?: {
    externalUrl?: string;
    [key: string]: unknown;
  } | null;
}

interface UseNotificationHandlerOptions {
  isAuthenticated: boolean;
}

export const useNotificationHandler = ({ isAuthenticated }: UseNotificationHandlerOptions) => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse): Promise<void> => {
      const data = response.notification.request.content.data as NotificationData;

      // 읽음 처리 + 배지 동기화 + 쿼리 갱신
      if (isAuthenticated && data.notificationId) {
        try {
          await notificationService.markAsRead(data.notificationId);
          await notificationService.syncBadgeCount();
          await queryClient.invalidateQueries({
            queryKey: notificationQueryKeys.all,
          });
        } catch (error) {
          console.log('[Notification] Failed to mark as read:', error);
        }
      }

      // 내부 라우팅
      if (data.route) {
        router.push(data.route as never);
        return;
      }

      // 외부 URL 열기
      if (data.metadata?.externalUrl) {
        await Linking.openURL(data.metadata.externalUrl);
      }
    },
    [isAuthenticated, notificationService, queryClient],
  );

  const handleForegroundNotification = useCallback(() => {
    if (isAuthenticated) {
      notificationService.syncBadgeCount().catch(console.error);
      queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.all,
      });
    }
  }, [isAuthenticated, notificationService, queryClient]);

  return {
    handleNotificationResponse,
    handleForegroundNotification,
  };
};
