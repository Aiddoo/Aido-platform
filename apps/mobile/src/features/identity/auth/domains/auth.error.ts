import { ErrorCode } from '@aido/api/errors';
import { isCodedError } from '@src/core/errors/result';
import { isApiError } from '@src/shared/errors';

/** 앱이 직접 판단한 소셜 로그인 실패. 문구는 `errors` 카탈로그에 같은 키로 둔다 */
export const AUTH_ERROR_CODE = {
  LOGIN_CANCELLED: 'AUTH_LOGIN_CANCELLED',
  PROVIDER_ERROR: 'AUTH_PROVIDER_ERROR',
  NO_CODE_RECEIVED: 'AUTH_NO_CODE_RECEIVED',
  APPLE_NO_TOKEN: 'AUTH_APPLE_NO_TOKEN',
  APPLE_INVALID_RESPONSE: 'AUTH_APPLE_INVALID_RESPONSE',
  APPLE_UNAVAILABLE: 'AUTH_APPLE_UNAVAILABLE',
  UNKNOWN: 'AUTH_UNKNOWN',
} as const;

export function isLoginCancelledError(error: unknown) {
  return isCodedError(error, AUTH_ERROR_CODE.LOGIN_CANCELLED);
}

export function isEmailNotVerifiedError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.EMAIL_0503);
}

export function isEmailAlreadyRegisteredError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.EMAIL_0501);
}

export function isPasswordMismatchError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.USER_0602);
}

/** 현재 비밀번호 칸(탈퇴 password, 비밀번호 변경 currentPassword)에 보일 서버 오류. type은 그 칸 문구를 고르는 byType 키다 */
export const PASSWORD_MISMATCH_FIELD_ERROR = { type: 'passwordMismatch' } as const;

export function findPasswordFieldError(error: unknown) {
  return isPasswordMismatchError(error) ? PASSWORD_MISMATCH_FIELD_ERROR : null;
}

export function isVerificationCodeInvalidError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.VERIFY_0751);
}

export function isVerificationCodeExpiredError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.VERIFY_0752);
}

export function isVerificationAttemptsExceededError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.VERIFY_0754);
}

/** 재발송 실패가 쿨다운 중(VERIFY_0753)이면 서버가 알려 준 남은 초를, 아니면 null을 돌려준다. */
export function findResendCooldown(error: unknown): number | null {
  if (!isApiError(error) || !error.hasCode(ErrorCode.VERIFY_0753)) {
    return null;
  }
  const remaining = error.details?.remainingSeconds;
  return typeof remaining === 'number' ? remaining : null;
}
