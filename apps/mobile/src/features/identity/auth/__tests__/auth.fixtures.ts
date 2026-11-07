import type {
  ChangePasswordResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  LinkedAccountsResponse,
  ResendVerificationResponse,
  ResetPasswordResponse,
} from '@aido/api';
import { ApiError } from '@src/core/errors/api-error';

import type { AuthTokens, AuthTokensEnvelope, RegisterEnvelope } from '../schemas/auth.schema';

const generateAuthTokensDto = (): AuthTokensEnvelope => ({
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  accessToken: 'access-token-jwt',
  refreshToken: 'refresh-token-jwt',
  name: '테스트',
  profileImage: 'https://example.com/avatar.jpg',
  accountRestored: false,
});

export const createAuthTokensDto = (
  overrides?: Partial<AuthTokensEnvelope>,
): AuthTokensEnvelope => ({
  ...generateAuthTokensDto(),
  ...overrides,
});

const generateAuthTokens = (): AuthTokens => ({
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  accessToken: 'access-token-jwt',
  refreshToken: 'refresh-token-jwt',
  userName: null,
  userProfileImage: null,
  accountRestored: false,
  isNewUser: false,
});

export const createAuthTokens = (overrides?: Partial<AuthTokens>): AuthTokens => ({
  ...generateAuthTokens(),
  ...overrides,
});

const generateRegisterDto = (): RegisterEnvelope => ({
  message: '인증 메일이 발송되었습니다.',
  email: 'test@example.com',
  emailSent: true,
});

export const createRegisterDto = (overrides?: Partial<RegisterEnvelope>): RegisterEnvelope => ({
  ...generateRegisterDto(),
  ...overrides,
});

const generateResendVerificationDto = (): ResendVerificationResponse => ({
  message: '인증 메일이 재발송되었습니다.',
  email: 'test@example.com',
  retryAfterSeconds: 60,
});

export const createResendVerificationDto = (
  overrides?: Partial<ResendVerificationResponse>,
): ResendVerificationResponse => ({
  ...generateResendVerificationDto(),
  ...overrides,
});

const generateChangePasswordDto = (): ChangePasswordResponse => ({
  message: '비밀번호가 성공적으로 변경되었습니다.',
});

export const createChangePasswordDto = (
  overrides?: Partial<ChangePasswordResponse>,
): ChangePasswordResponse => ({
  ...generateChangePasswordDto(),
  ...overrides,
});

const generateDeleteAccountDto = (): DeleteAccountResponse => ({
  message: '계정이 탈퇴 처리되었습니다.',
  deletedAt: '2026-02-13T10:00:00.000Z',
  gracePeriodDays: 30,
});

export const createDeleteAccountDto = (
  overrides?: Partial<DeleteAccountResponse>,
): DeleteAccountResponse => ({
  ...generateDeleteAccountDto(),
  ...overrides,
});

const generateForgotPasswordDto = (): ForgotPasswordResponse => ({
  message: '등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.',
});

export const createForgotPasswordDto = (
  overrides?: Partial<ForgotPasswordResponse>,
): ForgotPasswordResponse => ({
  ...generateForgotPasswordDto(),
  ...overrides,
});

const generateResetPasswordDto = (): ResetPasswordResponse => ({
  message: '비밀번호가 성공적으로 변경되었습니다.',
});

export const createResetPasswordDto = (
  overrides?: Partial<ResetPasswordResponse>,
): ResetPasswordResponse => ({
  ...generateResetPasswordDto(),
  ...overrides,
});

const generateLinkedAccountsDto = (): LinkedAccountsResponse => ({
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
});

export const createLinkedAccountsDto = (
  overrides?: Partial<LinkedAccountsResponse>,
): LinkedAccountsResponse => ({
  ...generateLinkedAccountsDto(),
  ...overrides,
});

export const createAuthApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'AUTH_ERROR',
    overrides?.message ?? '인증 오류',
    overrides?.status ?? 401,
  );

export const INVALID_DTO = { invalid: 'data' };
