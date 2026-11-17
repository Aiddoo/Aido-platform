import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const ForecastRateLimits = defineRateLimits({
  readReport: { limitPerMinute: 60 },
});
