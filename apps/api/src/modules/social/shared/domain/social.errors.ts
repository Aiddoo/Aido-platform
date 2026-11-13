import { ErrorCode } from "@aido/api/errors";
import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

// 콕과 리마인드 콕이 함께 쓰는 불변식이다

export function nudgeMessageTooLong(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { maxLength: NUDGE_LIMITS.MAX_MESSAGE_LENGTH });
}

export function cannotNudgeSelf(): DomainException {
  return new DomainException(ErrorCode.NUDGE_1104);
}
