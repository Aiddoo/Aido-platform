import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const InviteRateLimits = defineRateLimits({
  rotate: { limitPerHour: 3 },
  preview: { limitPerMinute: 20 },
});
