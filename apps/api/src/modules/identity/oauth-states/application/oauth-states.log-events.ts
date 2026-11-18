export const OAuthStateLogEvent = {
  OAUTH_REDIRECT_REJECTED: "identity.oauth.redirect.rejected",
  OAUTH_STATE_REJECTED: "identity.oauth.state.rejected",
  OAUTH_EXCHANGE_REJECTED: "identity.oauth.exchange.rejected",
  OAUTH_EXCHANGE_CREATED: "identity.oauth.exchange.created",
  OAUTH_EXCHANGE_CONSUMED: "identity.oauth.exchange.consumed",
  OAUTH_ERROR_REDIRECT_FAILED: "identity.oauth.error-redirect.failed",
  OAUTH_CALLBACK_FAILED: "identity.oauth.callback.failed",
} as const;
