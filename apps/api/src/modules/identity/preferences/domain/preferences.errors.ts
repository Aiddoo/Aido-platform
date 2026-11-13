import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function reminderTimeOutOfRange(): DomainException {
  return new DomainException(ErrorCode.PREFERENCE_1702);
}
