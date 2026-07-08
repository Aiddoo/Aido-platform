import type { NotificationType } from '@aido/validators';
import { pushNotificationDataSchema } from '@aido/validators';
import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { FRIEND_QUERY_KEYS } from '@src/features/friend/presentations/constants/friend-query-keys.constant';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { useTrack } from '@src/shared/analytics';
import { toError } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import type * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { match } from 'ts-pattern';
import { getInternalRoute } from '../../models/notification.model';

interface UseNotificationHandlerOptions {
  isAuthenticated: boolean;
}

export const useNotificationHandler = ({ isAuthenticated }: UseNotificationHandlerOptions) => {
  const notificationService = useNotificationService();
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const logger = useLogger();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastNavigationTimeRef = useRef(0);

  // ref로 최신 auth 상태를 추적하여 deferred 실행 시 stale closure 방지
  const isAuthenticatedRef = useRef(isAuthenticated);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse): Promise<void> => {
      // 0. 연타 방지: 500ms 잠금 (모든 사이드 이펙트 실행 전 차단)
      const now = Date.now();
      if (now - lastNavigationTimeRef.current < 500) {
        return;
      }
      lastNavigationTimeRef.current = now;

      const rawData = response.notification.request.content.data;

      // 1. Zod 검증으로 타입 안정성 확보
      const parseResult = pushNotificationDataSchema.safeParse(rawData);
      if (!parseResult.success) {
        logger.error('[Notification] Invalid payload', undefined, { error: parseResult.error });
        return;
      }
      const data = parseResult.data;

      // 2. Analytics 추적
      trackEvent('push_notification_opened', { type: data.type });
      if (data.type === 'WEEKLY_ACHIEVEMENT') {
        trackEvent('badge_opened_from_notification');
      }

      // 3. 읽음 처리 + 배지 동기화 (ref로 최신 auth 상태 참조)
      if (isAuthenticatedRef.current && data.notificationId) {
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
          logger.warn('[Notification] Failed to mark as read', { error });
        }
      }

      // 4. Action Type 기반 분기 처리
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
            data.action?.url ?? getInternalRoute(data.type as NotificationType, data.context);

          if (route) {
            router.navigate(route as Href);
          }
        });
    },
    [trackEvent, logger, notificationService, queryClient],
  );

  const handleForegroundNotification = useCallback(
    (notification?: Notifications.Notification) => {
      if (!isAuthenticated) {
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const invalidations: Promise<void>[] = [
          queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }),
          notificationService.syncBadgeCount(),
        ];

        const notificationType = notification?.request.content.data?.type as string | undefined;
        if (notificationType === 'FOLLOW_NEW' || notificationType === 'FOLLOW_ACCEPTED') {
          invalidations.push(queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.all }));
        }

        Promise.all(invalidations).catch((e) =>
          logger.error('[Notification] Handler failed', toError(e)),
        );
      }, 1000);
    },
    [isAuthenticated, logger, notificationService, queryClient],
  );

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
