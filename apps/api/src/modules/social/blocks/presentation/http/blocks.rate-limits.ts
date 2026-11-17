import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const BlockRateLimits = defineRateLimits({
  write: { limitPerMinute: 30 },
});
