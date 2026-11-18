import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const BroadcastCampaignRateLimits = defineRateLimits({
  createCampaign: { limitPerMinute: 5 },
});
