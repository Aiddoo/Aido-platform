import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const VoiceDigestRateLimits = defineRateLimits({
  digest: { limitPerMinute: 4, limitPerDay: 30 },
});
