import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 하루 한 번은 같은 job key·실행 기록이 막고, 이 한도는 연타·두 기기 동시 요청의 요청 수만 줄인다
export const SuggestionRateLimits = defineRateLimits({
  requestAnalysis: { limitPerMinute: 5 },
});
