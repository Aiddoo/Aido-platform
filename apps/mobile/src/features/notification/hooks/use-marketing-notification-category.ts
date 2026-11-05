import { useLogger, usePushNotificationGateway } from '@src/bootstrap/providers/di-context';
import { getErrorMessage } from '@src/shared/errors';
import { i18n } from '@src/shared/i18n';
import { useEffect } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';

export function useMarketingNotificationCategory() {
  const logger = useLogger();
  const gateway = usePushNotificationGateway();

  useEffect(() => {
    gateway
      .setCategory({
        identifier: 'MARKETING',
        actions: [
          {
            identifier: 'MARKETING_OPT_OUT',
            title: i18n.t('notification:actions.marketingOptOut'),
            opensAppToForeground: true,
          },
        ],
      })
      .catch((error) =>
        logger.warn(NOTIFICATION_LOG_EVENT.MARKETING_CATEGORY_REGISTRATION_FAILED, {
          error: getErrorMessage(error),
        }),
      );
  }, [gateway, logger]);
}
