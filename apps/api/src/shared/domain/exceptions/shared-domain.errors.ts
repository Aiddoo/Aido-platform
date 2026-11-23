import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "./domain.exception.js";

export function invalidUserId(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "userId" });
}

export function invalidTimezone(): DomainException {
  // 출시 앱이 받는 오류 details 키라 timeZone 그대로 둔다
  return new DomainException(ErrorCode.SYS_0002, { field: "timeZone" });
}
