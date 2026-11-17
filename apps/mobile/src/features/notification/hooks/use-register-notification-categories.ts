import {
  MARKETING_PUSH_CATEGORY_ID,
  TODO_REMINDER_PUSH_CATEGORY_ID,
  TODO_REMINDER_SNOOZE_MINUTES,
} from '@aido/api/vocabulary';
import { useLogger, usePushNotification } from '@src/bootstrap/providers/di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { useEffect } from 'react';

import { NOTIFICATION_LOG_EVENT } from '../constants/notification-log-events';
import {
  marketingOptOutActionSchema,
  todoReminderActionSchema,
} from '../domains/push-notification-response.model';

/** 서버 categoryId마다 알림 버튼을 등록한다. 버튼 문구가 앱 언어를 따르도록 언어가 바뀌면 다시 등록한다 */
export function useRegisterNotificationCategories() {
  const logger = useLogger();
  const gateway = usePushNotification();
  const { t } = useTranslation('notification');

  useEffect(() => {
    gateway
      .setCategory({
        identifier: MARKETING_PUSH_CATEGORY_ID,
        actions: [
          {
            identifier: marketingOptOutActionSchema.value,
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
    // 1단계는 두 버튼 모두 앱을 열어 로그인·할 일 화면을 거친다
    gateway
      .setCategory({
        identifier: TODO_REMINDER_PUSH_CATEGORY_ID,
        actions: [
          {
            identifier: todoReminderActionSchema.enum.complete,
            title: t('actions.todoReminderComplete'),
            opensAppToForeground: true,
          },
          {
            identifier: todoReminderActionSchema.enum.snooze,
            title: t('actions.todoReminderSnooze', { minutes: TODO_REMINDER_SNOOZE_MINUTES }),
            opensAppToForeground: true,
          },
        ],
      })
      .catch((error) =>
        logger.warn(NOTIFICATION_LOG_EVENT.TODO_REMINDER_CATEGORY_REGISTRATION_FAILED, {
          error: getErrorMessage(error),
        }),
      );
  }, [gateway, logger, t]);
}
