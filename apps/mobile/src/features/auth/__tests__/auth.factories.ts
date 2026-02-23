import type {
  AuthTokens as AuthTokensDTO,
  ChangePasswordResponse,
  ConsentResponse,
  DeleteAccountResponse,
  LinkedAccountsResponse,
  PreferenceResponse,
  RegisterResponse,
  ResendVerificationResponse,
  UpdateMarketingConsentResponse,
} from '@aido/validators';
import { ApiError } from '@src/shared/errors/api-error';

// -- Auth Tokens --

const generateAuthTokensDto = (): AuthTokensDTO => ({
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  accessToken: 'access-token-jwt',
  refreshToken: 'refresh-token-jwt',
  name: '테스트',
  profileImage: 'https://example.com/avatar.jpg',
});

export const createAuthTokensDto = (overrides?: Partial<AuthTokensDTO>): AuthTokensDTO => ({
  ...generateAuthTokensDto(),
  ...overrides,
});

// -- Preference --

const generatePreferenceDto = (): PreferenceResponse => ({
  pushEnabled: true,
  nightPushEnabled: false,
  timezone: 'Asia/Seoul',
  morningReminderHour: 8,
  eveningReminderHour: 21,
});

export const createPreferenceDto = (
  overrides?: Partial<PreferenceResponse>,
): PreferenceResponse => ({
  ...generatePreferenceDto(),
  ...overrides,
});

// -- Consent --

const generateConsentDto = (): ConsentResponse => ({
  termsAgreedAt: '2026-01-01T00:00:00.000Z',
  privacyAgreedAt: '2026-01-01T00:00:00.000Z',
  agreedTermsVersion: '1.0.0',
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
});

export const createConsentDto = (overrides?: Partial<ConsentResponse>): ConsentResponse => ({
  ...generateConsentDto(),
  ...overrides,
});

// -- Register --

const generateRegisterDto = (): RegisterResponse => ({
  message: '인증 메일이 발송되었습니다.',
  email: 'test@example.com',
});

export const createRegisterDto = (overrides?: Partial<RegisterResponse>): RegisterResponse => ({
  ...generateRegisterDto(),
  ...overrides,
});

// -- Resend Verification --

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

// -- Update Marketing Consent --

const generateUpdateMarketingConsentDto = (): UpdateMarketingConsentResponse => ({
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
});

export const createUpdateMarketingConsentDto = (
  overrides?: Partial<UpdateMarketingConsentResponse>,
): UpdateMarketingConsentResponse => ({
  ...generateUpdateMarketingConsentDto(),
  ...overrides,
});

// -- Change Password --

const generateChangePasswordDto = (): ChangePasswordResponse => ({
  message: '비밀번호가 성공적으로 변경되었습니다.',
});

export const createChangePasswordDto = (
  overrides?: Partial<ChangePasswordResponse>,
): ChangePasswordResponse => ({
  ...generateChangePasswordDto(),
  ...overrides,
});

// -- Delete Account --

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

// -- Linked Accounts --

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
});

export const createLinkedAccountsDto = (
  overrides?: Partial<LinkedAccountsResponse>,
): LinkedAccountsResponse => ({
  ...generateLinkedAccountsDto(),
  ...overrides,
});

// -- Common --

export const createAuthApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'AUTH_ERROR',
    overrides?.message ?? '인증 오류',
    overrides?.status ?? 401,
  );

export const INVALID_DTO = { invalid: 'data' };
