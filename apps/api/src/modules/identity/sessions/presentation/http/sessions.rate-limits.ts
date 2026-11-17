import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 코드를 맞히는 요청(이메일 인증)은 코드의 시도 횟수 제한과 별개로 요청 수를 막는다
export const SessionRateLimits = defineRateLimits({
  verifyEmail: { limitPerMinute: 10 },
  login: { limitPerMinute: 10 },
  refresh: { limitPerMinute: 20 },
  mobileOAuthLogin: { limitPerMinute: 10 },
});
