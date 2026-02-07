import type { NotificationType } from '@aido/validators';
import { pushNotificationDataSchema } from '@aido/validators';
import { useNotificationService } from '@src/bootstrap/providers/di-provider';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import type * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { match } from 'ts-pattern';
import { NotificationPolicy } from '../../models/notification.model';

interface UseNotificationHandlerOptions {
  isAuthenticated: boolean;
}

export const useNotificationHandler = ({ isAuthenticated }: UseNotificationHandlerOptions) => {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
          // Optimistic: 즉시 1 감소
          const count = queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount());

          if (count !== undefined && count > 0) {
            const newCount = count - 1;
            queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.unreadCount(), newCount);
            await notificationService.setBadgeCount(newCount);
          }

          await queryClient.invalidateQueries({
            queryKey: NOTIFICATION_QUERY_KEYS.all,
          });
        } catch (error) {
          console.log('[Notification] Failed to mark as read:', error);
        }
      }

      // 3. Action Type 기반 분기 처리
      match(data.action?.type)
        .with('BROWSER', () => {
          if (data.action?.url) {
            Linking.openURL(data.action.url);
          }
        })
        .with('WEBVIEW', () => {
          if (data.action?.url) {
            router.push(`/webview/${encodeURIComponent(data.action.url)}` as Href);
          }
        })
        .otherwise(() => {
          const route =
            data.action?.url ??
            NotificationPolicy.internalRoute({
              type: data.type as NotificationType,
              context: data.context,
            });

          if (route) {
            router.push(route as Href);
          }
        });
    },
    [isAuthenticated, notificationService, queryClient],
  );

  const handleForegroundNotification = useCallback(() => {
    if (!isAuthenticated) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }),
        notificationService.syncBadgeCount(),
      ]).catch(console.error);
    }, 1000);
  }, [isAuthenticated, notificationService, queryClient]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    handleNotificationResponse,
    handleForegroundNotification,
  };
};
