import { ErrorCode } from '@aido/api/errors';
import { isCodedError } from '@src/core/errors/result';
import { isApiError } from '@src/shared/errors';

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

export function isVerificationCodeInvalidError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.VERIFY_0751);
}

export function isVerificationCodeExpiredError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.VERIFY_0752);
}

export function isVerificationAttemptsExceededError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.VERIFY_0754);
}

export function findResendCooldown(error: unknown): number | null {
  if (!isApiError(error) || !error.hasCode(ErrorCode.VERIFY_0753)) {
    return null;
  }
  const remaining = error.details?.remainingSeconds;
  return typeof remaining === 'number' ? remaining : null;
}
