import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const BroadcastRateLimits = defineRateLimits({
  createCampaign: { limitPerMinute: 5 },
});
