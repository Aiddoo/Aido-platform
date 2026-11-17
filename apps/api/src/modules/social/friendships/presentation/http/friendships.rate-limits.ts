import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const FriendshipRateLimits = defineRateLimits({
  sendRequest: { limitPerMinute: 30 },
});
