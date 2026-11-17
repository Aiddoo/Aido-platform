import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const UserBlockRateLimits = defineRateLimits({
  write: { limitPerMinute: 30 },
});
