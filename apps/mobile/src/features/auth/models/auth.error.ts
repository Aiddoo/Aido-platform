import { ClientError } from '@src/shared/errors';
import type { z } from 'zod';

export interface ExpoCodedError extends Error {
  code?: string;
}

const EXPO_APPLE_ERROR_CODES = {
  REQUEST_CANCELED: 'ERR_REQUEST_CANCELED',
  REQUEST_FAILED: 'ERR_REQUEST_FAILED',
  INVALID_RESPONSE: 'ERR_INVALID_RESPONSE',
  NOT_AVAILABLE: 'ERR_NOT_AVAILABLE',
} as const;

/** Auth 도메인 기본 에러 */
export class AuthError extends ClientError {
  override readonly name: string = 'AuthError';
  readonly code: string = 'AUTH_ERROR';

  constructor(message: string = '인증 작업에 실패했어요') {
    super(message);
  }

  /** Expo Apple 에러 → AuthError 변환 */
  static fromExpoAppleError(error: ExpoCodedError): AuthError {
    switch (error.code) {
      case EXPO_APPLE_ERROR_CODES.REQUEST_CANCELED:
        return new AuthLoginCancelledError();
      case EXPO_APPLE_ERROR_CODES.REQUEST_FAILED:
      case EXPO_APPLE_ERROR_CODES.INVALID_RESPONSE:
        return new AuthProviderError('apple', 'Apple 인증 응답이 올바르지 않아요');
      case EXPO_APPLE_ERROR_CODES.NOT_AVAILABLE:
        return new AuthProviderError('apple', 'Apple 로그인을 사용할 수 없어요');
      default:
        return new AuthError(error.message);
    }
  }

  /** 알 수 없는 에러 → AuthError 변환 */
  static fromUnknown(error: unknown): AuthError {
    if (error instanceof AuthError) return error;
    if (error instanceof Error) return new AuthError(error.message);
    return new AuthError();
  }
}

/** 로그인 취소 */
export class AuthLoginCancelledError extends AuthError {
  override readonly name = 'AuthLoginCancelledError';
  override readonly code = 'AUTH_LOGIN_CANCELLED';

  constructor() {
    super('로그인이 취소되었어요');
  }
}

/** 응답 검증 실패 */
export class AuthValidationError extends AuthError {
  override readonly name = 'AuthValidationError';
  override readonly code = 'AUTH_VALIDATION';
  readonly zodError: z.ZodError | null;
  readonly endpoint: string | null;

  constructor(zodError: z.ZodError | null = null, endpoint: string | null = null) {
    super('잘못된 인증 응답이에요');
    this.zodError = zodError;
    this.endpoint = endpoint;
  }

  getValidationDetails(): string | null {
    if (!this.zodError) return null;
    return this.zodError.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
  }
}

/** Provider별 로그인 실패 (Apple, Google 등) */
export class AuthProviderError extends AuthError {
  override readonly name = 'AuthProviderError';
  override readonly code = 'AUTH_PROVIDER_ERROR';
  readonly provider: string;

  constructor(provider: string, message?: string) {
    super(message ?? `${provider} 로그인에 실패했어요`);
    this.provider = provider;
  }
}

export const isAuthError = (error: unknown): error is AuthError => error instanceof AuthError;

export const isExpoCodedError = (error: unknown): error is ExpoCodedError =>
  error instanceof Error && 'code' in error && typeof error.code === 'string';

export const isCancelledError = (error: unknown): error is AuthLoginCancelledError =>
  error instanceof AuthLoginCancelledError;

export const isValidationError = (error: unknown): error is AuthValidationError =>
  error instanceof AuthValidationError;
