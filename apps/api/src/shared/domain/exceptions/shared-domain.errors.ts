import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "./domain.exception.js";

export function invalidUserId(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "userId" });
}

export function invalidTimeZone(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "timeZone" });
}
