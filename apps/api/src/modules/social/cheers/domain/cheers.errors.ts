import { ErrorCode } from "@aido/api/errors";
import { CHEER_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function cheerMessageTooLong(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { maxLength: CHEER_LIMITS.MAX_MESSAGE_LENGTH });
}

export function cannotCheerSelf(): DomainException {
  return new DomainException(ErrorCode.CHEER_1204);
}
