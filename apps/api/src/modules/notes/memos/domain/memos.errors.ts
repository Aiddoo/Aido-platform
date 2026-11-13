import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function memoContentLengthOutOfRange(length: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "content", length });
}
