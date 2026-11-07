import { isBusinessError } from '@src/core/errors/result';

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
