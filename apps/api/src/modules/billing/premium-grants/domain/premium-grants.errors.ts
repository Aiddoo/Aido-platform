import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function invalidGrantDuration(durationDays: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "durationDays", durationDays });
}

export function invalidGrantSourceKey(length: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "sourceKey", length });
}
