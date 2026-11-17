import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const InviteRedemptionRateLimits = defineRateLimits({
  redeem: { limitPerMinute: 10 },
});
