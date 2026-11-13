import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function idempotencyKeyRequired(): ApplicationException {
  return new ApplicationException(ErrorCode.AI_1316);
}
