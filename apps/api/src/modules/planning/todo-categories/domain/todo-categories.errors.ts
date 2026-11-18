import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function invalidCategoryColor(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { message: "HEX 색상 코드 형식이 아닙니다" });
}

export function categoryNameLengthOutOfRange(maxLength: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { maxLength });
}
