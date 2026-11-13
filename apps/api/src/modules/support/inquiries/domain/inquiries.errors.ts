import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function inquiryContentLengthOutOfRange(length: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "content", length });
}
