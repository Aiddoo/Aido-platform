import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const UserReportRateLimits = defineRateLimits({
  report: { limitPerMinute: 10 },
});
