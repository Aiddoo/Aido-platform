import { ErrorCode } from "@aido/api/errors";
import { match } from "ts-pattern";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { AccountProvider } from "../domain/auth.constants.js";
import type { SessionValidity } from "../domain/session-validity.domain-service.js";

export function accountDeleted(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0606, { userId });
}

export function accountAlreadyExists(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0604);
}

export function emailAlreadyRegistered(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.EMAIL_0501, { email });
}

/** 공급자 계정이 이미 어떤 사용자에게 연결돼 있으면 출시 앱이 아는 공급자별 코드다 */
export function oauthAccountAlreadyLinked(
  provider: AccountProvider,
  providerAccountId: string,
): ApplicationException {
  return match(provider)
    .with(
      "KAKAO",
      () => new ApplicationException(ErrorCode.KAKAO_0306, { kakaoId: providerAccountId }),
    )
    .with(
      "APPLE",
      () => new ApplicationException(ErrorCode.APPLE_0355, { appleId: providerAccountId }),
    )
    .with(
      "GOOGLE",
      () => new ApplicationException(ErrorCode.GOOGLE_0405, { googleId: providerAccountId }),
    )
    .with(
      "NAVER",
      () => new ApplicationException(ErrorCode.NAVER_0455, { naverId: providerAccountId }),
    )
    .with(
      "CREDENTIAL",
      () => new ApplicationException(ErrorCode.USER_0604, { provider, providerAccountId }),
    )
    .exhaustive();
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

const AUTH_PERSISTENCE_CONFLICT_KINDS = [
  "EMAIL_ALREADY_EXISTS",
  "OAUTH_ACCOUNT_ALREADY_LINKED",
] as const;
export type AuthPersistenceConflictKind = (typeof AUTH_PERSISTENCE_CONFLICT_KINDS)[number];

/** 저장소가 자기 unique 제약 위반을 번역해 던지고 UseCase가 업무 오류로 바꾼다 */
export class AuthPersistenceConflict extends Error {
  readonly kind: AuthPersistenceConflictKind;

  constructor(kind: AuthPersistenceConflictKind) {
    super(kind);
    this.kind = kind;
    this.name = AuthPersistenceConflict.name;
  }
}
