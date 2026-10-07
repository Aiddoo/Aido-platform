export const IdentityLogEvent = {
  SESSION_LOGGED_OUT: "identity.session.logged-out",
  ALL_SESSIONS_LOGGED_OUT: "identity.session.all-logged-out",
  SESSION_REVOKED: "identity.session.revoked",
  SESSION_TOKENS_REFRESHED: "identity.session.tokens-refreshed",
  SESSION_ROTATION_CONFLICT: "identity.session.rotation.conflict",
  SESSION_TOKEN_REUSE_DETECTED: "identity.session.token-reuse.detected",
  VERIFICATION_EMAIL_FAILED: "identity.verification.email.failed",
  OAUTH_REDIRECT_REJECTED: "identity.oauth.redirect.rejected",
  OAUTH_STATE_REJECTED: "identity.oauth.state.rejected",
  OAUTH_EXCHANGE_REJECTED: "identity.oauth.exchange.rejected",
} as const;
