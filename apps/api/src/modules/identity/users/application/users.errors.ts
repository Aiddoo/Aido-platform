import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function userNotFound(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0601, { userId });
}

export function accountDeleted(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0606, { userId });
}

export function emailAlreadyRegistered(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.EMAIL_0501, { email });
}

export function deletionPasswordRequired(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0612);
}

/** 비밀번호·OAuth 코드·공급자 응답이 틀렸을 때 계정이 있는지 드러내지 않는 같은 로그인 실패다 */
export function invalidCredentials(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0602);
}

export function userTagCollided(cause: unknown): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, { detail: "userTag collision" }, { cause });
}

export function userTagGenerationFailed(attempts: number): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0611, { attempts });
}
