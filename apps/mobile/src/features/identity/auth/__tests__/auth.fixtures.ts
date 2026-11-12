import type {
  ChangePasswordResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  LinkedAccountsResponse,
  ResendVerificationResponse,
  ResetPasswordResponse,
} from '@aido/api';
import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';
import type { AppleSignInResult } from '@src/core/ports/social-auth-gateway';

import { type AuthTokens } from '../domains/auth.model';
import { type AuthTokensEnvelope, type RegisterEnvelope } from '../schemas/auth-response.schema';

function generateAuthTokensDto(): AuthTokensEnvelope {
  return {
    userId: 'clz7x5p8k0001qz0z8z8z8z8z',
    accessToken: 'access-token-jwt',
    refreshToken: 'refresh-token-jwt',
    name: '테스트',
    profileImage: 'https://example.com/avatar.jpg',
    accountRestored: false,
  };
}

export function createAuthTokensDto(overrides?: Partial<AuthTokensEnvelope>): AuthTokensEnvelope {
  return {
    ...generateAuthTokensDto(),
    ...overrides,
  };
}

function generateAuthTokens(): AuthTokens {
  return {
    userId: 'clz7x5p8k0001qz0z8z8z8z8z',
    accessToken: 'access-token-jwt',
    refreshToken: 'refresh-token-jwt',
    userName: null,
    userProfileImage: null,
    accountRestored: false,
    isNewUser: false,
  };
}

export function createAuthTokens(overrides?: Partial<AuthTokens>): AuthTokens {
  return {
    ...generateAuthTokens(),
    ...overrides,
  };
}

function generateRegisterDto(): RegisterEnvelope {
  return {
    message: '인증 메일이 발송되었습니다.',
    email: 'test@example.com',
    emailSent: true,
  };
}

export function createRegisterDto(overrides?: Partial<RegisterEnvelope>): RegisterEnvelope {
  return {
    ...generateRegisterDto(),
    ...overrides,
  };
}

function generateResendVerificationDto(): ResendVerificationResponse {
  return {
    message: '인증 메일이 재발송되었습니다.',
    email: 'test@example.com',
    retryAfterSeconds: 60,
  };
}

export function createResendVerificationDto(
  overrides?: Partial<ResendVerificationResponse>,
): ResendVerificationResponse {
  return {
    ...generateResendVerificationDto(),
    ...overrides,
  };
}

function generateChangePasswordDto(): ChangePasswordResponse {
  return {
    message: '비밀번호가 성공적으로 변경되었습니다.',
  };
}

export function createChangePasswordDto(
  overrides?: Partial<ChangePasswordResponse>,
): ChangePasswordResponse {
  return {
    ...generateChangePasswordDto(),
    ...overrides,
  };
}

function generateDeleteAccountDto(): DeleteAccountResponse {
  return {
    message: '계정이 탈퇴 처리되었습니다.',
    deletedAt: '2026-02-13T10:00:00.000Z',
    gracePeriodDays: 30,
  };
}

export function createDeleteAccountDto(
  overrides?: Partial<DeleteAccountResponse>,
): DeleteAccountResponse {
  return {
    ...generateDeleteAccountDto(),
    ...overrides,
  };
}

function generateForgotPasswordDto(): ForgotPasswordResponse {
  return {
    message: '등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.',
  };
}

export function createForgotPasswordDto(
  overrides?: Partial<ForgotPasswordResponse>,
): ForgotPasswordResponse {
  return {
    ...generateForgotPasswordDto(),
    ...overrides,
  };
}

function generateResetPasswordDto(): ResetPasswordResponse {
  return {
    message: '비밀번호가 성공적으로 변경되었습니다.',
  };
}

export function createResetPasswordDto(
  overrides?: Partial<ResetPasswordResponse>,
): ResetPasswordResponse {
  return {
    ...generateResetPasswordDto(),
    ...overrides,
  };
}

function generateLinkedAccountsDto(): LinkedAccountsResponse {
  return {
    accounts: [
      {
        provider: 'GOOGLE',
        linked: true,
        providerAccountId: 'g-123',
        linkedAt: '2026-01-15T00:00:00.000Z',
      },
      {
        provider: 'KAKAO',
        linked: false,
        providerAccountId: null,
        linkedAt: null,
      },
    ],
    canUnlink: true,
  };
}

export function createLinkedAccountsDto(
  overrides?: Partial<LinkedAccountsResponse>,
): LinkedAccountsResponse {
  return {
    ...generateLinkedAccountsDto(),
    ...overrides,
  };
}

export function createAuthApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'AUTH_0101',
    overrides?.message ?? '인증 오류',
    overrides?.status ?? 401,
  );
}

export const INVALID_DTO = { invalid: 'data' };

export function createAppleSignInSuccess(): AppleSignInResult {
  return {
    type: 'success',
    identityToken: 'apple-id-token',
    nonce: 'apple-nonce',
    givenName: null,
  };
}
