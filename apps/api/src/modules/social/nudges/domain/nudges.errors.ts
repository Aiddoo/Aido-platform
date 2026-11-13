import { ErrorCode } from "@aido/api/errors";
import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function nudgeMessageTooLong(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { maxLength: NUDGE_LIMITS.MAX_MESSAGE_LENGTH });
}

export function cannotNudgeSelf(): DomainException {
  return new DomainException(ErrorCode.NUDGE_1104);
}
