import {
  TODO_COMMENT_ACCOUNT_CLEANUP,
  type TodoCommentAccountCleanupPort,
} from "#api/modules/engagement/engagement-comments.public";
import { NotificationAccountCleanup } from "#api/modules/notification/notification-delivery.public";
import {
  USAGE_METER,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";

import {
  ACCOUNT_NOTIFICATION_CLEANUP,
  ACCOUNT_TODO_COMMENT_CLEANUP,
  ACCOUNT_USAGE_CLEANUP,
  type AccountNotificationCleanupPort,
  type AccountTodoCommentCleanupPort,
  type AccountUsageCleanupPort,
} from "./application/ports/account-cleanup.port.js";

export const accountNotificationCleanupProvider = {
  provide: ACCOUNT_NOTIFICATION_CLEANUP,
  inject: [NotificationAccountCleanup],
  useFactory: (cleanup: NotificationAccountCleanup): AccountNotificationCleanupPort => cleanup,
};

export const accountTodoCommentCleanupProvider = {
  provide: ACCOUNT_TODO_COMMENT_CLEANUP,
  inject: [TODO_COMMENT_ACCOUNT_CLEANUP],
  useFactory: (cleanup: TodoCommentAccountCleanupPort): AccountTodoCommentCleanupPort => cleanup,
};

export const accountUsageCleanupProvider = {
  provide: ACCOUNT_USAGE_CLEANUP,
  inject: [USAGE_METER],
  useFactory: (meter: Pick<UsageMeterPort, "deleteSubject">): AccountUsageCleanupPort => ({
    cleanupInTransaction: async (userId) => {
      await meter.deleteSubject(userId);
    },
  }),
};
