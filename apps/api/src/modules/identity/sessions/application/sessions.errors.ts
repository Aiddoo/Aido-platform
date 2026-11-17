import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";

import type { AccountProvider } from "../../linked-accounts/domain/linked-accounts.constants.js";
import type { SessionValidity } from "../domain/session-validity.domain-service.js";

export function emailNotVerified(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.EMAIL_0503, { email });
}

/** 공급자 계정의 이메일이 이미 다른 방식으로 가입돼 있고 그 계정에 이 공급자가 연결돼 있지 않다 */
export function oauthAccountNotLinked(
  provider: AccountProvider,
  providerAccountId: string,
  email: string,
): ApplicationException {
  return new ApplicationException(ErrorCode.SOCIAL_0206, { provider, providerAccountId, email });
}

export function invalidAccessToken(reason: string): ApplicationException {
  return new ApplicationException(ErrorCode.AUTH_0101, { reason });
}

export function invalidRefreshToken(): ApplicationException {
  return new ApplicationException(ErrorCode.AUTH_0104);
}

export function adminRequired(): ApplicationException {
  return new ApplicationException(ErrorCode.ADMIN_1401);
}

/** 이미 회전한 refresh token이 다시 왔다. 유출로 보고 그 토큰 묶음(tokenFamily)의 세션을 끊었다 */
export function refreshTokenReused(): ApplicationException {
  return new ApplicationException(ErrorCode.SESSION_0704, { tokenFamily: undefined });
}

export function sessionNotFound(sessionId?: string): ApplicationException {
  return new ApplicationException(ErrorCode.SESSION_0701, { sessionId });
}

export function sessionExpired(sessionId?: string): ApplicationException {
  return new ApplicationException(ErrorCode.SESSION_0702, { sessionId });
}

export function sessionRevoked(sessionId?: string): ApplicationException {
  return new ApplicationException(ErrorCode.SESSION_0703, { sessionId, reason: undefined });
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
      return sessionRevoked(sessionId);
    case "expired":
      return sessionExpired(sessionId);
  }
}
