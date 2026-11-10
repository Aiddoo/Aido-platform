import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { SessionValidity } from "../domain/session-validity.domain-service.js";

export function accountDeleted(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0606, { userId });
}

export function accountAlreadyExists(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0604);
}

function sessionNotFound(sessionId?: string): ApplicationException {
  return new ApplicationException(ErrorCode.SESSION_0701, { sessionId });
}

/** 세션이 없거나 폐기·만료면 출시 앱이 아는 SESSION_07xx 오류다. 유효하면 null */
export function sessionRejection(
  validity: SessionValidity | "missing",
  sessionId?: string,
): ApplicationException | null {
  switch (validity) {
    case "valid":
      return null;
    case "missing":
      return sessionNotFound(sessionId);
    case "revoked":
      return new ApplicationException(ErrorCode.SESSION_0703, { sessionId, reason: undefined });
    case "expired":
      return new ApplicationException(ErrorCode.SESSION_0702, { sessionId });
  }
}

export type AuthPersistenceConflictKind = "EMAIL_ALREADY_EXISTS" | "OAUTH_ACCOUNT_ALREADY_LINKED";

/** 저장소가 자기 unique 제약 위반을 번역해 던지고 UseCase가 업무 오류로 바꾼다 */
export class AuthPersistenceConflict extends Error {
  readonly kind: AuthPersistenceConflictKind;

  constructor(kind: AuthPersistenceConflictKind) {
    super(kind);
    this.kind = kind;
    this.name = AuthPersistenceConflict.name;
  }
}
