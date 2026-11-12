import {
  ErrorCode,
  HttpStatus,
  verificationResendCooldownErrorDetailsSchema,
} from '@aido/api/errors';
import { isCodedError } from '@src/core/errors/result';
import { isApiError, isConnectivityError } from '@src/shared/errors';
import { match } from 'ts-pattern';

import { type OAuthProviderSlug } from './oauth.model';

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

/** 로그인에서는 이메일·비밀번호가, 탈퇴·비밀번호 변경에서는 현재 비밀번호가 틀렸다 */
export function isPasswordMismatchError(error: unknown) {
  return isApiError(error) && error.hasCode(ErrorCode.USER_0602);
}

/** 현재 비밀번호 칸(탈퇴 password, 비밀번호 변경 currentPassword)에 보일 서버 오류. type은 그 칸 문구를 고르는 byType 키다 */
export const PASSWORD_MISMATCH_FIELD_ERROR = { type: 'passwordMismatch' } as const;

export function findPasswordFieldError(error: unknown) {
  return isPasswordMismatchError(error) ? PASSWORD_MISMATCH_FIELD_ERROR : null;
}

/** 코드가 틀렸거나(0751) 만료됐거나(0752) 시도를 다 써(0754) 코드 칸으로 돌아가 다시 받아야 한다. 문구는 `errors` 카탈로그다 */
const VERIFICATION_CODE_REJECTION_CODES = [
  ErrorCode.VERIFY_0751,
  ErrorCode.VERIFY_0752,
  ErrorCode.VERIFY_0754,
] as const;

/** 인증 코드 칸(비밀번호 재설정 code)에 보일 서버 오류. type은 그 칸 상태를 고르는 키다 */
export const VERIFICATION_CODE_FIELD_ERROR = { type: 'verificationCodeRejected' } as const;

export function findVerificationCodeFieldError(error: unknown) {
  return isApiError(error) && VERIFICATION_CODE_REJECTION_CODES.some((code) => error.hasCode(code))
    ? VERIFICATION_CODE_FIELD_ERROR
    : null;
}

/** 재발송 실패가 쿨다운 중(VERIFY_0753)이면 서버가 알려 준 남은 초를, 아니면 null을 돌려준다. */
export function findResendCooldown(error: unknown): number | null {
  if (!isApiError(error) || !error.hasCode(ErrorCode.VERIFY_0753)) {
    return null;
  }
  const details = verificationResendCooldownErrorDetailsSchema.safeParse(error.details);
  return details.success ? details.data.remainingSeconds : null;
}

/**
 * 로그아웃을 위해 남긴 refresh 토큰을 쓰지 못했을 때. 요청 과다(429)·서버 장애(5xx)는 기록을 두고 다음 복귀 때 다시
 * 시도하고, 그 밖의 거절(만료·재사용·없는 토큰)은 세션이 이미 끝난 것이다. refresh는 봉투를 읽지 않는 원시 응답이라
 * 코드 대신 상태로 가른다
 */
export function getPendingRefreshFailure(status: number): 'retry' | 'ended' {
  return status === HttpStatus.TOO_MANY_REQUESTS || status >= HttpStatus.INTERNAL_SERVER_ERROR
    ? 'retry'
    : 'ended';
}

/** 로그인 실패를 추적할 때의 이유. 서버·공급자 코드를 그대로 싣지 않고 몇 갈래로 묶는다 */
export type LoginFailureReason =
  | 'email_not_verified'
  | 'invalid_credentials'
  | 'network'
  | 'rejected'
  | 'unknown';

/** 사용자가 직접 닫은 소셜 창은 실패가 아니라 null이다. 서버가 거부한 것만 rejected이고, 앱이 판단한 실패(창 열기·코드 없음)는 unknown이다 */
export function findLoginFailureReason(
  error: unknown,
  method: 'email' | OAuthProviderSlug,
): LoginFailureReason | null {
  if (isLoginCancelledError(error)) {
    return null;
  }
  return match(error)
    .returnType<LoginFailureReason>()
    .when(isEmailNotVerifiedError, () => 'email_not_verified')
    .when(
      (value) => method === 'email' && isPasswordMismatchError(value),
      () => 'invalid_credentials',
    )
    .when(isConnectivityError, () => 'network')
    .when(isApiError, () => 'rejected')
    .otherwise(() => 'unknown');
}
