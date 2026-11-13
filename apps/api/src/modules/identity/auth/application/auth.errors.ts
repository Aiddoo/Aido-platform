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

/** 같은 종류 코드를 방금 보냈다. 앱은 남은 초로 다시 보내기 타이머를 켠다(운영 응답에도 싣는 공개 details) */
export function verificationResendCooldown(remainingSeconds: number): ApplicationException {
  return new ApplicationException(ErrorCode.VERIFY_0753, { remainingSeconds });
}

export function verificationAttemptsExceeded(): ApplicationException {
  return new ApplicationException(ErrorCode.VERIFY_0754);
}

export function invalidVerificationCode(): ApplicationException {
  return new ApplicationException(ErrorCode.VERIFY_0751);
}

export function emailAlreadyVerified(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0604, {
    email,
    message: "이미 인증이 완료된 계정입니다.",
  });
}

export function emailNotRegistered(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.EMAIL_0502, { email });
}

export function emailNotVerified(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.EMAIL_0503, { email });
}

/** 비밀번호·OAuth 코드·공급자 응답이 틀렸을 때 계정이 있는지 드러내지 않는 같은 로그인 실패다 */
export function invalidCredentials(): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0602);
}

export function userNotFound(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0601, { userId });
}

export function accountLocked(email: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0607, { email, remainingMinutes: undefined });
}

export function accountSuspended(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0605, { userId });
}

export function socialAccountPasswordUnchangeable(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0613, { userId });
}

export function passwordAlreadySet(userId: string): ApplicationException {
  return new ApplicationException(ErrorCode.USER_0614, { userId });
}

export function unsupportedOAuthProvider(provider: string): ApplicationException {
  return new ApplicationException(ErrorCode.SOCIAL_0204, {
    provider,
    reason: `Unsupported provider: ${provider}`,
  });
}

/** 공급자 계정의 이메일이 이미 다른 방식으로 가입돼 있고 그 계정에 이 공급자가 연결돼 있지 않다 */
export function oauthAccountNotLinked(
  provider: AccountProvider,
  providerAccountId: string,
  email: string,
): ApplicationException {
  return new ApplicationException(ErrorCode.SOCIAL_0206, { provider, providerAccountId, email });
}

export function invalidSocialToken(provider: AccountProvider): ApplicationException {
  return new ApplicationException(ErrorCode.SOCIAL_0202, { provider });
}

export function expiredSocialToken(provider: AccountProvider): ApplicationException {
  return new ApplicationException(ErrorCode.SOCIAL_0203, { provider });
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

/** 이미 회전한 refresh token이 다시 왔다. 유출로 보고 그 사용자의 세션을 모두 끊었다 */
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
