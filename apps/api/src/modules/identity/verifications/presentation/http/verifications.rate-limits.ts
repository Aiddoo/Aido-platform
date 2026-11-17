import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const VerificationRateLimits = defineRateLimits({
  resendVerification: { limitPerMinute: 5 },
});
