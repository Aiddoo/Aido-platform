import { ErrorCode } from "@aido/api/errors";
import { NUDGE_LIMITS } from "@aido/api/vocabulary";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

// 같은 Context의 slice 둘 이상이 함께 쓰는 불변식이다(콕·리마인드 콕, 초대·초대 수락)

export function nudgeMessageTooLong(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { maxLength: NUDGE_LIMITS.MAX_MESSAGE_LENGTH });
}

export function cannotNudgeSelf(): DomainException {
  return new DomainException(ErrorCode.NUDGE_1104);
}

export function invalidInviteCode(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "inviteCode" });
}
