import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { NotificationId } from "../domain/notification-id.vo.js";

export function notificationNotFound(notificationId: NotificationId): ApplicationException {
  return new ApplicationException(ErrorCode.NOTIFICATION_1004, {
    notificationId: notificationId.value,
  });
}

/** 같은 알림(중복 방지 인덱스)이 이미 저장됐다. 발행은 건너뛰고 HTTP로 나가지 않는다. */
export class DuplicateNotificationError extends Error {
  constructor() {
    super("Notification already exists");
    this.name = DuplicateNotificationError.name;
  }
}

export function duplicateNotification(): DuplicateNotificationError {
  return new DuplicateNotificationError();
}

// nextIds가 요청한 수만큼 id를 주지 않으면 시퀀스 조회가 어긋난 것이다
export function pushDispatchIdMissing(): Error {
  return new Error("Push dispatch id sequence returned fewer ids than requested");
}
