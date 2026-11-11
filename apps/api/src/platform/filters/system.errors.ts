import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

/** 저장소가 번역하지 않은 DB 오류를 출시 앱이 아는 공통 코드로 바꿀 때 쓴다. */
export function invalidParameter(details?: unknown): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0002, details);
}

export function internalServerError(details?: unknown): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, details);
}

export function concurrentModification(): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0004);
}

export function transientDatabaseFailure(details?: unknown): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0005, details);
}
