import type { PushNotificationData } from '@aido/validators';
import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError, unwrap } from '@src/shared/errors';
import { useTodayKey } from '@src/shared/hooks/useToday';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys.constant';
import { resolveNotificationDestination } from '../navigation/notification-destination';
import { optimisticallyMarkNotificationsRead } from '../queries/notification-cache';
import { useNotificationNavigation } from './use-notification-navigation';

export type NotificationResponseInput = {
  data: PushNotificationData;
  actionIdentifier: string;
  isCurrentSession: () => boolean;
};

export function useNotificationResponseHandler() {
  const navigate = useNotificationNavigation();
  const notificationService = useNotificationService();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const logger = useLogger();
  const today = useTodayKey();

  return useCallback(
    async ({
      data,
      actionIdentifier,
      isCurrentSession,
    }: NotificationResponseInput): Promise<'handled' | 'discarded'> => {
      if (actionIdentifier === 'MARKETING_OPT_OUT') {
        if (!data.marketingOptOutToken) return 'discarded';
        unwrap(await notificationService.optOutMarketingPush(data.marketingOptOutToken));
        try {
          trackEvent('marketing_push_opted_out', { source: 'push_action' });
        } catch (error) {
          logger.warn('[Notification] Opt-out analytics failed', { error });
        }
        return 'handled';
      }

      if (!isCurrentSession()) return 'discarded';
      if (data.notificationId > 0) {
        try {
          unwrap(await notificationService.markAsRead(data.notificationId));
        } catch (error) {
          if (isApiError(error) && (error.status === 403 || error.status === 404))
            return 'discarded';
          throw error;
        }
      }
      if (!isCurrentSession()) return 'discarded';

      await navigate(resolveNotificationDestination(data, { today }));

      try {
        trackEvent('push_notification_opened', {
          type: data.type,
          action: data.action.type,
          ...(data.campaignKey && { campaign_key: data.campaignKey }),
          ...(data.variantId && { variant_id: data.variantId }),
          ...(data.purpose && { purpose: data.purpose }),
        });
        if (data.type === 'WEEKLY_ACHIEVEMENT') trackEvent('badge_opened_from_notification');
      } catch (error) {
        logger.warn('[Notification] Open analytics failed', { error });
      }

      if (data.notificationId > 0 && isCurrentSession()) {
        void optimisticallyMarkNotificationsRead(queryClient, data.notificationId, {
          canApply: isCurrentSession,
        })
          .then(() => (isCurrentSession() ? notificationService.syncBadgeCount() : undefined))
          .catch((error) => logger.warn('[Notification] Local read sync failed', { error }));
        void notificationService
          .markOpened(data.notificationId)
          .then(unwrap)
          .then(() =>
            isCurrentSession()
              ? queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
              : undefined,
          )
          .catch((error) => logger.warn('[Notification] Open recording failed', { error }));
      }
      return 'handled';
    },
    [logger, navigate, notificationService, queryClient, today, trackEvent],
  );
}
