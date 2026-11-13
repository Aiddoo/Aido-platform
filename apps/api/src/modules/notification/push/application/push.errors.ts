import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function invalidPushToken(): ApplicationException {
  return new ApplicationException(ErrorCode.NOTIFICATION_1001);
}
