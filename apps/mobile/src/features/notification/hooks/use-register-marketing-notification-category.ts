import { MARKETING_PUSH_CATEGORY_ID } from '@aido/api/vocabulary';
import { useLogger, usePushNotification } from '@src/bootstrap/providers/di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { useEffect } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import { MARKETING_OPT_OUT_ACTION } from '../constants/notification.constants';

export function useRegisterMarketingNotificationCategory() {
  const logger = useLogger();
  const gateway = usePushNotification();
  const { t } = useTranslation('notification');

  useEffect(() => {
    gateway
      .setCategory({
        identifier: MARKETING_PUSH_CATEGORY_ID,
        actions: [
          {
            identifier: MARKETING_OPT_OUT_ACTION,
            title: t('actions.marketingOptOut'),
            opensAppToForeground: true,
          },
        ],
      })
      .catch((error) =>
        logger.warn(NOTIFICATION_LOG_EVENT.MARKETING_CATEGORY_REGISTRATION_FAILED, {
          error: getErrorMessage(error),
        }),
      );
  }, [gateway, logger, t]);
}
