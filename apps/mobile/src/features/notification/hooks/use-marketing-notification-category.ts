import { useLogger } from '@src/bootstrap/providers/di-context';
import { i18n } from '@src/shared/i18n';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';

export function useMarketingNotificationCategory() {
  const logger = useLogger();

  useEffect(() => {
    Notifications.setNotificationCategoryAsync('MARKETING', [
      {
        identifier: 'MARKETING_OPT_OUT',
        buttonTitle: i18n.t('notification:actions.marketingOptOut'),
        options: { opensAppToForeground: true },
      },
    ]).catch((error) =>
      logger.warn(NOTIFICATION_LOG_EVENT.MARKETING_CATEGORY_REGISTRATION_FAILED, { error }),
    );
  }, [logger]);
}
