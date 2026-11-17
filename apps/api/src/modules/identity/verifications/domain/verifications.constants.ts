export const VERIFICATION_TYPE = {
  EMAIL_VERIFY: "EMAIL_VERIFY",
  PASSWORD_RESET: "PASSWORD_RESET",
  PASSWORD_SETUP: "PASSWORD_SETUP",
} as const;

export type VerificationType = (typeof VERIFICATION_TYPE)[keyof typeof VERIFICATION_TYPE];

export const VERIFICATION_VALIDITIES = ["valid", "used", "expired", "exhausted"] as const;
export const VERIFICATION_REJECTIONS = [
  "missing",
  "used",
  "expired",
  "exhausted",
  "mismatch",
] as const;

/** 만료한 코드 hash는 다시 읽지 않아 하루만 둔다 */
export const VERIFICATION_RETENTION_DAYS = 1;

// OWASP Forgot Password: 다시 보내기 대기(60초)만으로는 이메일 하나가 분마다 새 코드(시도 5번)를 받는다.
// 용도(가입 인증·재설정·비밀번호 설정)마다 따로 세어 한 흐름을 다 써도 다른 흐름은 막히지 않는다
export const VERIFICATION_EMAIL_CAP = {
  WINDOW_HOURS: 24,
  // 오타·재시도를 하는 본인에게 넉넉하고 한 IP가 그 이메일 몫의 1/4만 쓴다
  MAX_CODES_PER_EMAIL_SOURCE: 5,
  // 받은편지함 하나가 용도마다 하루 20통을 넘지 않고 막으려면 서로 다른 IP 4곳이 다 써야 한다
  MAX_CODES_PER_EMAIL: 20,
  // 비밀번호 설정은 로그인한 본인만 요청해 IP로 나누지 않고 사용자마다 하루 10통이다
  MAX_CODES_PER_USER: 10,
} as const;
