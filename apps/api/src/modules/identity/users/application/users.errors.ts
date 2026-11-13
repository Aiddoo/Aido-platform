import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

export function userNotFound(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0601, { userId });
}

export function deletionPasswordRequired(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0612);
}

export function invalidCredentials(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0602);
}

export function userTagCollided(cause: unknown): ApplicationException {
  return new ApplicationException(ErrorCode.SYS_0001, { detail: "userTag collision" }, { cause });
}

export function userTagGenerationFailed(attempts: number): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0611, { attempts });
}
