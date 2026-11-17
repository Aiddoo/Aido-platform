import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function notificationAccessDenied(notificationId: number): DomainException {
  return new DomainException(ErrorCode.NOTIFICATION_1005, { notificationId });
}
