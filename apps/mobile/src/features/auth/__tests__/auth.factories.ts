import type {
  AuthTokens as AuthTokensDTO,
  ChangePasswordResponse,
  ConsentResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  LinkedAccountsResponse,
  PreferenceResponse,
  RegisterResponse,
  ResendVerificationResponse,
  ResetPasswordResponse,
  UpdateMarketingConsentResponse,
} from '@aido/validators';
import { ApiError } from '@src/shared/errors/api-error';

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

const generatePreferenceDto = (): PreferenceResponse => ({
  pushEnabled: true,
  nightPushEnabled: false,
  timezone: 'Asia/Seoul',
  morningReminderHour: 8,
  morningReminderMinute: 0,
  eveningReminderHour: 21,
  eveningReminderMinute: 0,
});

export const createPreferenceDto = (
  overrides?: Partial<PreferenceResponse>,
): PreferenceResponse => ({
  ...generatePreferenceDto(),
  ...overrides,
});

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

const generateRegisterDto = (): RegisterResponse => ({
  message: '인증 메일이 발송되었습니다.',
  email: 'test@example.com',
});

export const createRegisterDto = (overrides?: Partial<RegisterResponse>): RegisterResponse => ({
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

const generateUpdateMarketingConsentDto = (): UpdateMarketingConsentResponse => ({
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
});

export const createUpdateMarketingConsentDto = (
  overrides?: Partial<UpdateMarketingConsentResponse>,
): UpdateMarketingConsentResponse => ({
  ...generateUpdateMarketingConsentDto(),
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
