export const AuthInfraLogEvent = {
  OAUTH_TOKEN_EXCHANGE_FAILED: "identity.oauth.token-exchange.failed",
  OAUTH_TOKEN_EXCHANGE_INVALID: "identity.oauth.token-exchange.invalid",
  OAUTH_NONCE_REJECTED: "identity.oauth.nonce.rejected",
  OAUTH_TOKEN_VERIFY_FAILED: "identity.oauth.token-verify.failed",
  SESSION_CACHE_READ_FAILED: "identity.session-cache.read.failed",
  SESSION_CACHE_WRITE_FAILED: "identity.session-cache.write.failed",
  USER_TAG_COLLIDED: "identity.user-tag.collided",
} as const;
