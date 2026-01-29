import { ClientError } from '@src/shared/errors';
import { match } from 'ts-pattern';

/**
 * expo-modules-core의 CodedError 타입 정의
 * @see https://docs.expo.dev/versions/latest/sdk/apple-authentication/#error-codes
 */
export interface ExpoCodedError extends Error {
  code: string;
}

export const isExpoCodedError = (error: unknown): error is ExpoCodedError =>
  error instanceof Error && 'code' in error && typeof error.code === 'string';

/**
 * expo-apple-authentication 에러 코드
 * @see https://docs.expo.dev/versions/latest/sdk/apple-authentication/#error-codes
 */
const AppleAuthErrorCode = {
  REQUEST_CANCELED: 'ERR_REQUEST_CANCELED',
  REQUEST_FAILED: 'ERR_REQUEST_FAILED',
  INVALID_RESPONSE: 'ERR_INVALID_RESPONSE',
  NOT_AVAILABLE: 'ERR_NOT_AVAILABLE',
} as const;

type AppleAuthErrorCodeType = (typeof AppleAuthErrorCode)[keyof typeof AppleAuthErrorCode];

export class AuthError extends ClientError {
  override readonly name: string = 'AuthError';
  readonly code: string = 'AUTH_ERROR';

  constructor(message: string = '인증 작업에 실패했어요') {
    super(message);
  }
}

/** 로그인 취소 */
export class AuthCancelledError extends AuthError {
  override readonly name = 'AuthCancelledError';
  override readonly code = 'AUTH_CANCELLED';

  constructor() {
    super('로그인이 취소되었어요');
  }
}

/** 네트워크 연결 문제 */
export class AuthNetworkError extends AuthError {
  override readonly name = 'AuthNetworkError';
  override readonly code = 'AUTH_NETWORK';

  constructor() {
    super('네트워크 연결을 확인해주세요');
  }
}

/** 응답 검증 실패 */
export class AuthValidationError extends AuthError {
  override readonly name = 'AuthValidationError';
  override readonly code = 'AUTH_VALIDATION';

  constructor(message: string = '잘못된 응답 형식이에요') {
    super(message);
  }
}

/** Apple 인증 실패 */
export class AppleAuthError extends AuthError {
  override readonly name = 'AppleAuthError';
  override readonly code = 'APPLE_AUTH_FAILED';

  constructor(message: string = 'Apple 로그인에 실패했어요') {
    super(message);
  }

  /** Expo Apple 에러 → AuthError 변환 */
  static fromExpoError(error: ExpoCodedError): AuthError {
    return match(error.code as AppleAuthErrorCodeType)
      .with(AppleAuthErrorCode.REQUEST_CANCELED, () => new AuthCancelledError())
      .with(
        AppleAuthErrorCode.REQUEST_FAILED,
        () => new AppleAuthError('Apple 인증 정보가 올바르지 않아요'),
      )
      .with(
        AppleAuthErrorCode.INVALID_RESPONSE,
        () => new AppleAuthError('Apple 응답을 처리할 수 없어요'),
      )
      .with(
        AppleAuthErrorCode.NOT_AVAILABLE,
        () => new AppleAuthError('Apple 로그인을 사용할 수 없어요'),
      )
      .otherwise(() => new AuthError(error.message));
  }
}

/** Google 인증 실패 */
export class GoogleAuthError extends AuthError {
  override readonly name = 'GoogleAuthError';
  override readonly code = 'GOOGLE_AUTH_FAILED';

  constructor(message: string = 'Google 로그인에 실패했어요') {
    super(message);
  }
}

// 타입 가드
export const isAuthError = (error: unknown): error is AuthError => error instanceof AuthError;
