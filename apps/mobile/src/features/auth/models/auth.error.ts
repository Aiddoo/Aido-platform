import type { BusinessError } from '@src/shared/errors';
import type { OAuthProviderSlug } from './oauth.model';

export interface ExpoCodedError extends Error {
  code?: string;
}

const EXPO_APPLE_ERROR_CODES = {
  REQUEST_CANCELED: 'ERR_REQUEST_CANCELED',
  REQUEST_FAILED: 'ERR_REQUEST_FAILED',
  INVALID_RESPONSE: 'ERR_INVALID_RESPONSE',
  NOT_AVAILABLE: 'ERR_NOT_AVAILABLE',
} as const;

export const AuthErrorCode = {
  LOGIN_CANCELLED: 'AUTH_LOGIN_CANCELLED',
  PROVIDER_ERROR: 'AUTH_PROVIDER_ERROR',
  VALIDATION_FAILED: 'AUTH_VALIDATION_FAILED',
  NO_CODE_RECEIVED: 'AUTH_NO_CODE_RECEIVED',
  UNKNOWN: 'AUTH_UNKNOWN',
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export class AuthError extends Error implements BusinessError {
  override readonly name = 'AuthError';

  constructor(
    public readonly code: AuthErrorCode | string,
    message: string,
  ) {
    super(message);
  }
}

export const AuthErrors = {
  loginCancelled: () => new AuthError(AuthErrorCode.LOGIN_CANCELLED, '로그인이 취소되었어요'),

  providerError: (provider: OAuthProviderSlug, msg?: string) =>
    new AuthError(AuthErrorCode.PROVIDER_ERROR, msg ?? `${provider} 로그인에 실패했어요`),

  validationFailed: (endpoint?: string) =>
    new AuthError(
      AuthErrorCode.VALIDATION_FAILED,
      endpoint ? `잘못된 인증 응답이에요 (${endpoint})` : '잘못된 인증 응답이에요',
    ),

  noCodeReceived: () => new AuthError(AuthErrorCode.NO_CODE_RECEIVED, '인증 코드를 받지 못했어요'),

  unknown: (msg?: string) => new AuthError(AuthErrorCode.UNKNOWN, msg ?? '인증 작업에 실패했어요'),

  fromExpoAppleError: (error: ExpoCodedError): AuthError => {
    switch (error.code) {
      case EXPO_APPLE_ERROR_CODES.REQUEST_CANCELED:
        return AuthErrors.loginCancelled();
      case EXPO_APPLE_ERROR_CODES.REQUEST_FAILED:
      case EXPO_APPLE_ERROR_CODES.INVALID_RESPONSE:
        return AuthErrors.providerError('apple', 'Apple 인증 응답이 올바르지 않아요');
      case EXPO_APPLE_ERROR_CODES.NOT_AVAILABLE:
        return AuthErrors.providerError('apple', 'Apple 로그인을 사용할 수 없어요');
      default:
        return AuthErrors.unknown(error.message);
    }
  },

  fromUnknown: (error: unknown): AuthError => {
    if (error instanceof AuthError) return error;
    if (error instanceof Error) return AuthErrors.unknown(error.message);
    return AuthErrors.unknown();
  },
} as const;

export const isAuthError = (error: unknown): error is AuthError => error instanceof AuthError;

export const isExpoCodedError = (error: unknown): error is ExpoCodedError =>
  error instanceof Error && 'code' in error && typeof error.code === 'string';

export const isCancelledError = (error: unknown): boolean =>
  error instanceof AuthError && error.code === AuthErrorCode.LOGIN_CANCELLED;

export const isValidationError = (error: unknown): boolean =>
  error instanceof AuthError && error.code === AuthErrorCode.VALIDATION_FAILED;
