import {
  changePasswordResponseSchema,
  deleteAccountResponseSchema,
  forgotPasswordResponseSchema,
  linkedAccountsResponseSchema,
  resendVerificationResponseSchema,
  resetPasswordResponseSchema,
} from '@aido/api/contracts/auth/v1';
import type { ErrorCodeType } from '@aido/api/errors';
import type { AppleSignInResult } from '@src/core/ports/social-auth-gateway';
import { createApiError } from '@src/testing/api-error';
import { defineFixture } from '@src/testing/fixture';

import { authTokensEnvelopeSchema, registerEnvelopeSchema } from '../schemas/auth-response.schema';

export const createAuthTokensDto = defineFixture(authTokensEnvelopeSchema, {
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  accessToken: 'access-token-jwt',
  refreshToken: 'refresh-token-jwt',
  name: '테스트',
  profileImage: 'https://example.com/avatar.jpg',
  accountRestored: false,
});

export const createRegisterDto = defineFixture(registerEnvelopeSchema, {
  message: '인증 메일이 발송되었습니다.',
  email: 'test@example.com',
  emailSent: true,
});

export const createDeleteAccountDto = defineFixture(deleteAccountResponseSchema, {
  message: '계정이 탈퇴 처리되었습니다.',
  deletedAt: '2026-02-13T10:00:00.000Z',
  gracePeriodDays: 30,
});

export const createChangePasswordDto = defineFixture(changePasswordResponseSchema, {
  message: '비밀번호가 성공적으로 변경되었습니다.',
});

export const createForgotPasswordDto = defineFixture(forgotPasswordResponseSchema, {
  message: '등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.',
});

export const createResetPasswordDto = defineFixture(resetPasswordResponseSchema, {
  message: '비밀번호가 성공적으로 변경되었습니다.',
});

export const createResendVerificationDto = defineFixture(resendVerificationResponseSchema, {
  message: '인증 코드를 다시 보냈습니다.',
  email: 'test@example.com',
});

export const createLinkedAccountsDto = defineFixture(linkedAccountsResponseSchema, {
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

export function createAuthApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return createApiError(overrides?.code ?? 'AUTH_0101', {
    message: overrides?.message ?? '인증 오류',
    status: overrides?.status ?? 401,
  });
}

export function createAppleSignInSuccess(): AppleSignInResult {
  return {
    type: 'success',
    identityToken: 'apple-id-token',
    nonce: 'apple-nonce',
    givenName: null,
  };
}
