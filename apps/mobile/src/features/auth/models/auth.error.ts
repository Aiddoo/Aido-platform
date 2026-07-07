import type { BusinessError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
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
  loginCancelled: () =>
    new AuthError(AuthErrorCode.LOGIN_CANCELLED, t('auth:errors.loginCancelled')),

  providerError: (provider: OAuthProviderSlug, msg?: string) =>
    new AuthError(
      AuthErrorCode.PROVIDER_ERROR,
      msg ?? t('auth:errors.providerFailed', { provider }),
    ),

  validationFailed: (endpoint?: string) =>
    new AuthError(
      AuthErrorCode.VALIDATION_FAILED,
      endpoint
        ? t('auth:errors.invalidResponseWithEndpoint', { endpoint })
        : t('auth:errors.invalidResponse'),
    ),

  noCodeReceived: () =>
    new AuthError(AuthErrorCode.NO_CODE_RECEIVED, t('auth:errors.noCodeReceived')),

  unknown: (msg?: string) => new AuthError(AuthErrorCode.UNKNOWN, msg ?? t('auth:errors.unknown')),

  fromExpoAppleError: (error: ExpoCodedError): AuthError => {
    switch (error.code) {
      case EXPO_APPLE_ERROR_CODES.REQUEST_CANCELED:
        return AuthErrors.loginCancelled();
      case EXPO_APPLE_ERROR_CODES.REQUEST_FAILED:
      case EXPO_APPLE_ERROR_CODES.INVALID_RESPONSE:
        return AuthErrors.providerError('apple', t('auth:errors.appleInvalidResponse'));
      case EXPO_APPLE_ERROR_CODES.NOT_AVAILABLE:
        return AuthErrors.providerError('apple', t('auth:errors.appleUnavailable'));
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
