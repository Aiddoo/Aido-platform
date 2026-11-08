import { useLogger } from '@src/bootstrap/providers/di-context';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { getCachedMe } from '@src/features/identity/user/queries/user-cache';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { NotificationPolicy } from '../domains/notification.model';
import { useMarkAsReadMutationOptions } from '../queries/notification.mutations';
import type { Notification } from '../schemas/notification.schema';
import { resolveNotificationDestination } from '../utils/notification-destination';
import { useNotificationNavigation } from './use-notification-navigation';

/**
 * 알림 센터에서 알림 하나를 연다. 읽음 처리 → 프리미엄 확인 → 목적지 계산 → 기록 → 이동 순서다.
 * 목록이 한 번 부르고 행에 넘겨 행마다 게이트·mutation을 만들지 않는다
 */
export function useOpenNotification() {
  const { t } = useTranslation('notification');
  const navigateToDestination = useNotificationNavigation();
  const windowSizeClass = useWindowSizeClass();
  const logger = useLogger();
  const { mutate: markAsRead } = useMutation(useMarkAsReadMutationOptions());
  const { trackEvent } = useTrack();
  const queryClient = useQueryClient();
  const gate = useEntitlementGate('AI_REPORT', { surface: 'notification_center' });

  return (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (
      NotificationPolicy.isAiFeature(notification) &&
      gate.promptIfBlocked({ description: t('list.premiumDescription') })
    ) {
      return;
    }

    const destination = resolveNotificationDestination(
      {
        type: notification.type,
        context: notification.context,
        routing: notification.routing,
        action: notification.action,
      },
      { shouldOpenToday: true, windowSizeClass, viewerId: getCachedMe(queryClient)?.id },
    );
    trackEvent('notification_center_opened', {
      type: notification.type,
      destination: destination.kind,
    });
    navigateToDestination(destination).catch((error) =>
      logger.warn(NOTIFICATION_LOG_EVENT.CENTER_NAVIGATION_FAILED, {
        error: getErrorMessage(error),
      }),
    );
  };
}
