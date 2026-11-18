import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function invalidPushToken(): ApplicationException {
  return new ApplicationException(ErrorCode.NOTIFICATION_1001);
}

// 같은 토큰이 동시에 등록돼 다른 트랜잭션이 먼저 그 토큰을 가져갔다. 원인 DB 오류는 cause로 남긴다
export class PushTokenRegistrationConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super("Push token registered concurrently", options);
    this.name = PushTokenRegistrationConflictError.name;
  }
}

export function pushTokenRegistrationConflict(cause?: unknown): PushTokenRegistrationConflictError {
  return new PushTokenRegistrationConflictError(cause == null ? undefined : { cause });
}
