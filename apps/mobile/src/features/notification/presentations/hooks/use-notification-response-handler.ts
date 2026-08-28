import { pushNotificationDataSchema } from '@aido/validators';
import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { unwrap } from '@src/shared/errors';
import { useQueryClient } from '@tanstack/react-query';
import type * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';
import { resolveNotificationDestination } from '../navigation/notification-destination';
import { optimisticallyMarkNotificationsRead } from '../queries/notification-cache';
import { useNotificationNavigation } from './use-notification-navigation';

interface UseNotificationResponseHandlerOptions {
  isAuthenticated: boolean;
}

export function useNotificationResponseHandler({
  isAuthenticated,
}: UseNotificationResponseHandlerOptions) {
  const navigate = useNotificationNavigation();
  const recordOpen = useNotificationOpenRecorder(isAuthenticated);
  const notificationService = useNotificationService();
  const { trackEvent } = useTrack();
  const logger = useLogger();
  const lastNavigationTimeRef = useRef(0);

  return useCallback(
    async (response: Notifications.NotificationResponse): Promise<void> => {
      const openedAt = Date.now();
      if (openedAt - lastNavigationTimeRef.current < 500) {
        return;
      }
      lastNavigationTimeRef.current = openedAt;

      const result = pushNotificationDataSchema.safeParse(
        response.notification.request.content.data,
      );
      if (!result.success) {
        logger.error('[Notification] Invalid payload', undefined, { error: result.error });
        return;
      }
      const data = result.data;

      if (response.actionIdentifier === 'MARKETING_OPT_OUT' && data.marketingOptOutToken) {
        notificationService
          .optOutMarketingPush(data.marketingOptOutToken)
          .then(unwrap)
          .then(() => trackEvent('marketing_push_opted_out', { source: 'push_action' }))
          .catch((error) => logger.warn('[Notification] Marketing opt-out failed', { error }));
        return;
      }

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

      navigate(
        resolveNotificationDestination({
          type: data.type,
          context: data.context,
          routing: data.routing,
          action: data.action,
        }),
      );
      recordOpen(data.notificationId);
    },
    [logger, navigate, notificationService, recordOpen, trackEvent],
  );
}

function useNotificationOpenRecorder(isAuthenticated: boolean) {
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
  const logger = useLogger();
  const isAuthenticatedRef = useRef(isAuthenticated);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  return useCallback(
    (notificationId: number) => {
      if (!isAuthenticatedRef.current || notificationId === 0) {
        return;
      }

      optimisticallyMarkNotificationsRead(queryClient, notificationId)
        .then(() => {
          const unreadCount =
            queryClient.getQueryData<number>(NOTIFICATION_QUERY_KEYS.unreadCount()) ?? 0;
          return notificationService.setBadgeCount(unreadCount);
        })
        .catch((error) => logger.warn('[Notification] Failed to update local open', { error }));

      notificationService
        .markOpened(notificationId)
        .then(unwrap)
        .then(() => queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all }))
        .catch((error) => logger.warn('[Notification] Failed to record open', { error }));
    },
    [logger, notificationService, queryClient],
  );
}
