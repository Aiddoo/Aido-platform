import { ErrorCode } from '@aido/api/errors';
import { isBusinessError } from '@src/core/errors/result';
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
  return isBusinessError(error, AUTH_ERROR_CODE.LOGIN_CANCELLED);
}

export function isEmailNotVerifiedError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.EMAIL_0503);
}

export function isEmailAlreadyRegisteredError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.EMAIL_0501);
}

/** 탈퇴·비밀번호 변경에서 현재 비밀번호가 틀렸다 */
export function isPasswordMismatchError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.USER_0602);
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
export function getResendCooldownAfterError(error: unknown): number | null {
  if (!isApiError(error) || !error.hasCode(ErrorCode.VERIFY_0753)) {
    return null;
  }
  const remaining = error.details?.remainingSeconds;
  return typeof remaining === 'number' ? remaining : null;
}
