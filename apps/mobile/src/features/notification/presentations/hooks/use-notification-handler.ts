import type { NotificationType } from '@aido/validators';
import { pushNotificationDataSchema } from '@aido/validators';
import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { FRIEND_QUERY_KEYS } from '@src/features/friend/presentations/constants/friend-query-keys.constant';
import { NOTIFICATION_QUERY_KEYS } from '@src/features/notification/presentations/constants/notification-query-keys.constant';
import { optimisticallyMarkNotificationsRead } from '@src/features/notification/presentations/queries/notification-cache';
import { useTrack } from '@src/shared/analytics';
import { toError, unwrap } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import type * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { resolveNotificationDestination } from '../../models/notification.model';

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

      if (response.actionIdentifier === 'MARKETING_OPT_OUT' && data.marketingOptOutToken) {
        void notificationService
          .optOutMarketingPush(data.marketingOptOutToken)
          .then(unwrap)
          .then(() => trackEvent('marketing_push_opted_out', { source: 'push_action' }))
          .catch((error) => logger.warn('[Notification] Marketing opt-out failed', { error }));
        return;
      }

      // 2. Analytics 추적
      trackEvent('push_notification_opened', {
        type: data.type,
        action: data.action.type,
        ...(data.campaignKey && { campaign_key: data.campaignKey }),
        ...(data.variantId && { variant_id: data.variantId }),
        ...(data.purpose && { purpose: data.purpose }),
      });
      if (data.type === 'WEEKLY_ACHIEVEMENT') {
        trackEvent('badge_opened_from_notification');
      }

      const destination = resolveNotificationDestination({
        type: data.type as NotificationType,
        context: data.context,
        action: data.action,
      });

      // 3. 화면 이동은 네트워크보다 먼저 수행한다. 기록/캐시는 독립적인 best-effort 작업이다.
      if (destination.kind === 'browser') {
        void Linking.openURL(destination.url);
      } else if (destination.kind === 'webview') {
        router.push(`/webview/${encodeURIComponent(destination.url)}` as Href);
      } else if (destination.kind === 'internal') {
        router.navigate(destination.route as Href);
      }

      if (isAuthenticatedRef.current && data.notificationId) {
        void optimisticallyMarkNotificationsRead(queryClient, data.notificationId).then(() => {
          const count =
            queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount()) ?? 0;
          return notificationService.setBadgeCount(count);
        });
        void notificationService
          .markOpened(data.notificationId)
          .then(unwrap)
          .then(() =>
            queryClient.invalidateQueries({
              queryKey: NOTIFICATION_QUERY_KEYS.all,
            }),
          )
          .catch((error) => logger.warn('[Notification] Failed to record open', { error }));
      }
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
