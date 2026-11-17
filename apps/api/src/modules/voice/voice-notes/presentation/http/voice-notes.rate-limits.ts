import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const VoiceNoteRateLimits = defineRateLimits({
  digest: { limitPerMinute: 4, limitPerDay: 30 },
});
