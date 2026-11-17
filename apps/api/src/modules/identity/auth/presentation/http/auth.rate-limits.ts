import { defineRateLimits } from "#api/platform/throttle/rate-limits";

// 코드를 맞히는 요청(이메일 인증·비밀번호 재설정·확인)은 코드의 시도 횟수 제한과 별개로 요청 수를 막는다
export const AuthRateLimits = defineRateLimits({
  register: { limitPerMinute: 5 },
  verifyEmail: { limitPerMinute: 10 },
  resendVerification: { limitPerMinute: 5 },
  login: { limitPerMinute: 10 },
  refresh: { limitPerMinute: 20 },
  forgotPassword: { limitPerMinute: 5 },
  resetPassword: { limitPerMinute: 5 },
  requestPasswordSetupCode: { limitPerMinute: 5 },
  setPassword: { limitPerMinute: 5 },
  changePassword: { limitPerMinute: 5 },
  exchangeOAuthCode: { limitPerMinute: 10 },
  linkSocialAccount: { limitPerMinute: 10 },
});
