import type { VERIFICATION_TYPE } from "@aido/api/vocabulary";

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

// OWASP Forgot Password: 다시 보내기 대기(60초)만으로는 이메일 하나가 분마다 새 코드(시도 5번)를 받는다
export const VERIFICATION_EMAIL_CAP = {
  MAX_CODES: 10,
  WINDOW_HOURS: 24,
} as const;
