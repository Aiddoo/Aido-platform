import { PASSWORD_RULES } from '@aido/api/vocabulary';

export interface PasswordRuleChecks {
  hasLetter: boolean;
  hasNumber: boolean;
  hasMinLength: boolean;
}

/** 계약 스키마가 막는 비밀번호 규칙을 칸 아래 체크 표시로 하나씩 보이려고 같은 vocabulary 값으로 나눠 본다 */
export function getPasswordRuleChecks(password: string): PasswordRuleChecks {
  return {
    hasLetter: PASSWORD_RULES.HAS_LETTER.test(password),
    hasNumber: PASSWORD_RULES.HAS_NUMBER.test(password),
    hasMinLength: PASSWORD_RULES.MIN_LENGTH <= password.length,
  };
}
