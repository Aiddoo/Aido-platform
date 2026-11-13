import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function pushUnavailableDevice(deviceId: string): DomainException {
  return new DomainException(ErrorCode.NOTIFICATION_1006, { deviceId });
}
