import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const UserRateLimits = defineRateLimits({
  deleteAccount: { limitPerHour: 3 },
});
