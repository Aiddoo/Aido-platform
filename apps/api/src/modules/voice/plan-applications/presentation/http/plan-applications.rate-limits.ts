import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const PlanApplicationRateLimits = defineRateLimits({
  apply: { limitPerMinute: 10 },
  createQuickPlan: { limitPerMinute: 20 },
});
