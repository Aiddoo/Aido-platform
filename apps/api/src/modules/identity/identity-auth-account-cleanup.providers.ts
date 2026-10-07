import {
  TODO_COMMENT_ACCOUNT_CLEANUP,
  type TodoCommentAccountCleanupPort,
} from "#api/modules/engagement/engagement-comments.public";
import { NotificationAccountCleanup } from "#api/modules/notification/notification-delivery.public";

import {
  ACCOUNT_NOTIFICATION_CLEANUP,
  ACCOUNT_TODO_COMMENT_CLEANUP,
  type AccountNotificationCleanupPort,
  type AccountTodoCommentCleanupPort,
} from "./application/ports/auth/account-cleanup.port.js";

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
