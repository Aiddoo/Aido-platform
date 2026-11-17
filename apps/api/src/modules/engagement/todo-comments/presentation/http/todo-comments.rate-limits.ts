import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 이어 쓰기 한 요청이 최대 5개라 작성은 글 수가 아니라 요청 수로 센다
export const TodoCommentRateLimits = defineRateLimits({
  write: { limitPerMinute: 30 },
  like: { limitPerMinute: 120 },
});
