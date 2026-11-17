import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const NudgeRateLimits = defineRateLimits({
  interact: { limitPerMinute: 30 },
});
