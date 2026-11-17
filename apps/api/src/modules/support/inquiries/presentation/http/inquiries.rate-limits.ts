import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const InquiryRateLimits = defineRateLimits({
  submit: { limitPerMinute: 5 },
});
