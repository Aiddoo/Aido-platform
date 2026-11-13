import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 저장된 상태가 아는 값이 아니다. 데이터 오류라 500이다 */
export function unknownRedemptionStatus(value: string): DomainException {
  return new DomainException(ErrorCode.SYS_0001, {
    detail: "Unknown invite redemption status",
    value,
  });
}

export function invalidRedemptionTransition(from: string, to: string): DomainException {
  return new DomainException(ErrorCode.SYS_0001, {
    detail: "Invalid invite redemption transition",
    from,
    to,
  });
}
