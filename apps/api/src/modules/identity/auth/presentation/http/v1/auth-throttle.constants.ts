/**
 * 인증 엔드포인트 한도. 인증 전 요청은 IP, `@ThrottleByUser()`를 붙인 요청은 로그인한 사용자 ID로
 * 센다. 코드를 맞히는 요청(verify-email·reset-password·비밀번호 확인)은 코드 자체의 시도 횟수 제한과
 * 별개로 요청 수를 막는다.
 */
export const AUTH_THROTTLE = {
  REGISTER: { ttl: 60_000, limit: 5 },
  VERIFY_EMAIL: { ttl: 60_000, limit: 10 },
  RESEND_VERIFICATION: { ttl: 60_000, limit: 5 },
  LOGIN: { ttl: 60_000, limit: 10 },
  REFRESH: { ttl: 60_000, limit: 20 },
  FORGOT_PASSWORD: { ttl: 60_000, limit: 5 },
  RESET_PASSWORD: { ttl: 60_000, limit: 5 },
  PASSWORD_SETUP_CODE: { ttl: 60_000, limit: 5 },
  SET_PASSWORD: { ttl: 60_000, limit: 5 },
  CHANGE_PASSWORD: { ttl: 60_000, limit: 5 },
  OAUTH_CODE: { ttl: 60_000, limit: 10 },
  LINK_SOCIAL_ACCOUNT: { ttl: 60_000, limit: 10 },
  DELETE_ACCOUNT: { ttl: 3_600_000, limit: 3 },
} as const;
