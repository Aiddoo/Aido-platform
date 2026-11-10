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
  AccountNotificationCleanupPort,
  AccountTodoCommentCleanupPort,
  AccountUsageCleanupPort,
} from "./application/ports/account-cleanup.port.js";

export const accountNotificationCleanupProvider = {
  provide: AccountNotificationCleanupPort,
  inject: [NotificationAccountCleanup],
  useFactory: (cleanup: NotificationAccountCleanup): AccountNotificationCleanupPort => cleanup,
};

export const accountTodoCommentCleanupProvider = {
  provide: AccountTodoCommentCleanupPort,
  inject: [TODO_COMMENT_ACCOUNT_CLEANUP],
  useFactory: (cleanup: TodoCommentAccountCleanupPort): AccountTodoCommentCleanupPort => cleanup,
};

export const accountUsageCleanupProvider = {
  provide: AccountUsageCleanupPort,
  inject: [USAGE_METER],
  useFactory: (meter: Pick<UsageMeterPort, "deleteSubject">): AccountUsageCleanupPort => ({
    cleanupInTransaction: async (userId) => {
      await meter.deleteSubject(userId);
    },
  }),
};
