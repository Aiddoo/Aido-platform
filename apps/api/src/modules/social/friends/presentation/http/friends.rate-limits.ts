import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const FriendRateLimits = defineRateLimits({
  sendRequest: { limitPerMinute: 30 },
});
