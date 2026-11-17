import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 코드를 맞히는 요청(비밀번호 재설정·설정)은 코드의 시도 횟수 제한과 별개로 요청 수를 막는다
export const LinkedAccountsRateLimits = defineRateLimits({
  forgotPassword: { limitPerMinute: 5 },
  resetPassword: { limitPerMinute: 5 },
  requestPasswordSetupCode: { limitPerMinute: 5 },
  setPassword: { limitPerMinute: 5 },
  changePassword: { limitPerMinute: 5 },
  linkSocialAccount: { limitPerMinute: 10 },
});
