/** 이 시간 안에 같은 refresh 토큰이 다시 오면 재사용 공격이 아니라 네트워크 재시도로 본다 */
export const TOKEN_REUSE_GRACE_PERIOD_MS = 10_000;

export const SESSION_RETENTION_DAYS = 30;
export const LOGIN_ATTEMPT_RETENTION_DAYS = 90;

export const SESSION_DEFAULTS = {
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

/** 기기 이름 또는 User-Agent. 세션을 기기별로 보여 줄 때 쓴다 */
export type DeviceFingerprint = string;

export const SESSION_VALIDITIES = ["valid", "revoked", "expired"] as const;
