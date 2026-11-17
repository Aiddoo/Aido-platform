import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const ActionPlanRateLimits = defineRateLimits({
  apply: { limitPerMinute: 10 },
  createQuickPlan: { limitPerMinute: 20 },
});
