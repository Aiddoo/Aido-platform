import type { PushNotificationData } from '@aido/api';
import { useLogger, useNotificationService } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { isApiError, unwrap } from '@src/shared/errors';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import { optimisticallyMarkNotificationsRead } from '../queries/notification-cache';
import { resolveNotificationDestination } from '../utils/navigation/notification-destination';
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
  const windowSizeClass = useWindowSizeClass();

  return useCallback(
    async ({
      data,
      actionIdentifier,
      isCurrentSession,
    }: NotificationResponseInput): Promise<'handled' | 'discarded'> => {
      if (actionIdentifier === 'MARKETING_OPT_OUT') {
        if (!data.marketingOptOutToken) {
          return 'discarded';
        }
        unwrap(await notificationService.optOutMarketingPush(data.marketingOptOutToken));
        try {
          trackEvent('marketing_push_opted_out', { source: 'push_action' });
        } catch (error) {
          logger.warn(NOTIFICATION_LOG_EVENT.OPT_OUT_ANALYTICS_FAILED, { error });
        }
        return 'handled';
      }

      if (!isCurrentSession()) {
        return 'discarded';
      }
      if (data.notificationId > 0) {
        try {
          unwrap(await notificationService.markAsRead(data.notificationId));
        } catch (error) {
          if (isApiError(error) && (error.status === 403 || error.status === 404)) {
            return 'discarded';
          }
          throw error;
        }
      }
      if (!isCurrentSession()) {
        return 'discarded';
      }

      await navigate(resolveNotificationDestination(data, { today, windowSizeClass }));

      try {
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
      } catch (error) {
        logger.warn(NOTIFICATION_LOG_EVENT.OPEN_ANALYTICS_FAILED, { error });
      }

      if (data.notificationId > 0 && isCurrentSession()) {
        optimisticallyMarkNotificationsRead(queryClient, data.notificationId, {
          canApply: isCurrentSession,
        })
          .then(() => (isCurrentSession() ? notificationService.syncBadgeCount() : undefined))
          .catch((error) => logger.warn(NOTIFICATION_LOG_EVENT.LOCAL_READ_SYNC_FAILED, { error }));
        notificationService
          .markOpened(data.notificationId)
          .then(unwrap)
          .then(() =>
            isCurrentSession()
              ? queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.all })
              : undefined,
          )
          .catch((error) => logger.warn(NOTIFICATION_LOG_EVENT.OPEN_RECORDING_FAILED, { error }));
      }
      return 'handled';
    },
    [logger, navigate, notificationService, queryClient, today, trackEvent, windowSizeClass],
  );
}
