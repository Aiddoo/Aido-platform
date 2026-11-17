import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const UserRateLimits = defineRateLimits({
  register: { limitPerMinute: 5 },
  deleteAccount: { limitPerHour: 3 },
});
