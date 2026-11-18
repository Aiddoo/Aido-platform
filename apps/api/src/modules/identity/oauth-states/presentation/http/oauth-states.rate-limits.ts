import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const OAuthStateRateLimits = defineRateLimits({
  exchangeOAuthCode: { limitPerMinute: 10 },
  linkWithExchangeCode: { limitPerMinute: 10 },
});
