import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 업로드는 100개 묶음 30개(3,000개)를 재시도까지 넉넉히 받고, 진행 조회는 2~3초 폴링을 받는다
export const TodoImportRateLimits = defineRateLimits({
  start: { limitPerMinute: 10, limitPerDay: 30 },
  receiveItems: { limitPerMinute: 120 },
  commit: { limitPerMinute: 10 },
  get: { limitPerMinute: 120 },
  findActive: { limitPerMinute: 30 },
  cancel: { limitPerMinute: 10 },
  requestUndo: { limitPerMinute: 10, limitPerDay: 20 },
});
