import type { NotificationContext, NotificationType } from '@aido/validators';
import { pushNotificationDataSchema } from '@aido/validators';
import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { notificationQueryKeys } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import type * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useCallback } from 'react';

interface UseNotificationHandlerOptions {
  isAuthenticated: boolean;
}

const getInternalRoute = (type: NotificationType, context?: NotificationContext): string | null => {
  switch (type) {
    // 친구 요청
    case 'FOLLOW_NEW':
      return '/friends';

    // 친구 프로필로 이동
    case 'FOLLOW_ACCEPTED':
    case 'CHEER_RECEIVED':
    case 'FRIEND_COMPLETED':
      return context?.friendId ? `/friends/${context.friendId}` : null;

    // 독촉: 할일 있으면 할일, 없으면 친구 프로필
    case 'NUDGE_RECEIVED':
      if (context?.todoId) return `/todos/${context.todoId}`;
      if (context?.friendId) return `/friends/${context.friendId}`;
      return null;

    // 할일 상세
    case 'TODO_REMINDER':
    case 'TODO_SHARED':
      return context?.todoId ? `/todos/${context.todoId}` : '/(tabs)/home';

    // 홈으로 이동
    case 'DAILY_COMPLETE':
    case 'MORNING_REMINDER':
    case 'EVENING_REMINDER':
      return '/(tabs)/home';

    // 달성 화면
    case 'WEEKLY_ACHIEVEMENT':
      return '/achievements';

    // 시스템 공지 (action.url로 처리되므로 여기선 null)
    case 'SYSTEM_NOTICE':
      return null;

    default:
      return null;
  }
};

export const useNotificationHandler = ({ isAuthenticated }: UseNotificationHandlerOptions) => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();

  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse): Promise<void> => {
      const rawData = response.notification.request.content.data;

      // 1. Zod 검증으로 타입 안정성 확보
      const parseResult = pushNotificationDataSchema.safeParse(rawData);
      if (!parseResult.success) {
        console.error('[Notification] Invalid payload:', parseResult.error);
        return;
      }
      const data = parseResult.data;

      // 2. 읽음 처리 + 배지 동기화
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

      // 3. Action Type 기반 분기 처리
      switch (data.action?.type) {
        case 'BROWSER':
          // External: 외부 브라우저로 열기
          if (data.action.url) {
            await Linking.openURL(data.action.url);
          }
          break;

        case 'WEBVIEW':
          // External: 인앱 브라우저
          if (data.action.url) {
            router.push(`/webview/${encodeURIComponent(data.action.url)}` as Href);
          }
          break;

        default: {
          // Internal: 서버 URL 우선, 없으면 클라이언트가 결정
          const route =
            data.action?.url ?? getInternalRoute(data.type as NotificationType, data.context);
          if (route) {
            router.push(route as Href);
          }
          break;
        }
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
