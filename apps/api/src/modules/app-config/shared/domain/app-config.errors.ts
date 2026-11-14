import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function appStoreVersionInvalid(length: number): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "latestVersion", length });
}
