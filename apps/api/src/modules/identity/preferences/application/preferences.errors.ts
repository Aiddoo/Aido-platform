import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function invalidTimezone(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002, { field: "timezone" });
}
