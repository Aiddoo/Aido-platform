import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const WeatherReportRateLimits = defineRateLimits({
  readReport: { limitPerMinute: 60 },
});
