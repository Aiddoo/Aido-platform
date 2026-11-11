import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { NotificationId } from "../domain/notification-id.vo.js";

export function notificationNotFound(notificationId: NotificationId): ApplicationException {
  return new ApplicationException(ErrorCode.NOTIFICATION_1004, {
    notificationId: notificationId.value,
  });
}
