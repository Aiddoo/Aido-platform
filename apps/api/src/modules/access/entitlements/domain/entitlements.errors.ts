import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

/** 지급 수량은 서버가 정한 양의 정수다. 아니면 지급 코드의 버그라 500이다 */
export function invalidGrantQuantity(feature: string, quantity: number): DomainException {
  return new DomainException(ErrorCode.SYS_0001, {
    reason: "feature grant quantity must be a positive integer",
    feature,
    quantity,
  });
}
