import { defineRateLimits } from "#api/platform/throttle/rate-limits";

export const ParsingRateLimits = defineRateLimits({
  parseTodo: { limitPerMinute: 20 },
  parseMemo: { limitPerMinute: 10 },
});
