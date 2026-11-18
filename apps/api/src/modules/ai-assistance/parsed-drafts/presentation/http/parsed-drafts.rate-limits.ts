import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const ParsedDraftRateLimits = defineRateLimits({
  parseTodo: { limitPerMinute: 20 },
  parseMemo: { limitPerMinute: 10 },
});
