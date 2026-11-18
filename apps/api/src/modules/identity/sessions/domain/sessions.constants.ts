export const SESSION_RETENTION_DAYS = 30;
export const LOGIN_ATTEMPT_RETENTION_DAYS = 90;

export const LOGIN_ATTEMPT = {
  LOCKOUT_MINUTES: 15,
  // 한 곳(IP, IPv6는 /64 대역)에서 이메일 하나를 5번 틀리면 잠가 남이 한 곳에서 본인을 잠그지 못한다
  MAX_FAILURES_PER_SOURCE: 5,
  // 여러 곳에 나눈 대입도 이메일마다 15분 20번에서 멈춘다. 남을 잠그려면 서로 다른 곳 4개가 필요하다
  MAX_FAILURES_PER_EMAIL: 20,
} as const;

export const REVOKE_REASON = {
  USER_LOGOUT: "USER_LOGOUT",
  USER_LOGOUT_ALL: "USER_LOGOUT_ALL",
  USER_REVOKE: "USER_REVOKE",
  TOKEN_REUSE_DETECTED: "TOKEN_REUSE_DETECTED",
  PASSWORD_RESET: "PASSWORD_RESET",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  ACCOUNT_DELETION: "ACCOUNT_DELETION",
} as const;

export type RevokeReason = (typeof REVOKE_REASON)[keyof typeof REVOKE_REASON];

export const SESSION_DEFAULTS = {
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

/** 기기 이름 또는 User-Agent. 세션을 기기별로 보여 줄 때 쓴다 */
export type DeviceFingerprint = string;

export const SESSION_VALIDITIES = ["valid", "revoked", "expired"] as const;
