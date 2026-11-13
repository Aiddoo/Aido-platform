export const TOKEN_REFRESHER_LOG_EVENT = {
  TOKEN_READ_FAILED: 'token-refresher.token-read.failed',
  ACCESS_TOKEN_READ_FAILED: 'token-refresher.access-token-read.failed',
  TRANSIENT_REFRESH_FAILED: 'token-refresher.transient-refresh.failed',
  TOKEN_PERSIST_FAILED: 'token-refresher.token-persist.failed',
  UNAUTHORIZED_RECOVERY_TIMED_OUT: 'token-refresher.unauthorized-recovery.timed-out',
} as const;
