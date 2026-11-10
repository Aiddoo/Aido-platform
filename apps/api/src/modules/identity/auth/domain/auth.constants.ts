import type { ACCOUNT_PROVIDERS, USER_STATUS, VERIFICATION_TYPE } from "@aido/api/vocabulary";

export type AccountProvider = (typeof ACCOUNT_PROVIDERS)[number];
export type UserStatus = (typeof USER_STATUS)[number];
export type VerificationType = (typeof VERIFICATION_TYPE)[keyof typeof VERIFICATION_TYPE];

/** Google·Apple은 이메일을 항상 검증해 같은 이메일의 기존 계정에 자동 연동한다(Kakao·Naver는 선택적이라 제외) */
export const TRUSTED_EMAIL_PROVIDERS: readonly AccountProvider[] = ["GOOGLE", "APPLE"];

/** 이 시간 안에 같은 refresh 토큰이 다시 오면 재사용 공격이 아니라 네트워크 재시도로 본다 */
export const TOKEN_REUSE_GRACE_PERIOD_MS = 10_000;

export const AUTH_DEFAULTS = {
  UNKNOWN_IP: "unknown",
  UNKNOWN_USER_AGENT: "unknown",
  DEFAULT_ACCESS_TOKEN_EXPIRES_SECONDS: 900,
  /** DB Session.deviceFingerprint varchar(64)와 같아야 한다 */
  MAX_DEVICE_FINGERPRINT_LENGTH: 64,
} as const;

export const LOGIN_FAILURE_REASON = {
  USER_NOT_FOUND: "USER_NOT_FOUND",
  NO_CREDENTIAL_ACCOUNT: "NO_CREDENTIAL_ACCOUNT",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  OAUTH_TOKEN_INVALID: "OAUTH_TOKEN_INVALID",
  OAUTH_TOKEN_EXPIRED: "OAUTH_TOKEN_EXPIRED",
  OAUTH_PROVIDER_ERROR: "OAUTH_PROVIDER_ERROR",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
} as const;

export type LoginFailureReason = (typeof LOGIN_FAILURE_REASON)[keyof typeof LOGIN_FAILURE_REASON];

export const TOKEN_VERIFY_ERROR = {
  EXPIRED: "expired",
  INVALID_SIGNATURE: "invalid_signature",
  WRONG_TYPE: "wrong_type",
  MALFORMED: "malformed",
} as const;

export type TokenVerifyError = (typeof TOKEN_VERIFY_ERROR)[keyof typeof TOKEN_VERIFY_ERROR];

/** 기기 이름 또는 User-Agent. 세션을 기기별로 보여 줄 때 쓴다 */
export type DeviceFingerprint = string;
