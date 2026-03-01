import { createMockHttpClient, createMockStorage } from '@src/shared/__tests__';
import {
  createAuthApiError,
  createAuthTokensDto,
  createChangePasswordDto,
  createConsentDto,
  createDeleteAccountDto,
  createForgotPasswordDto,
  createLinkedAccountsDto,
  createPreferenceDto,
  createRegisterDto,
  createResendVerificationDto,
  createResetPasswordDto,
  createUpdateMarketingConsentDto,
  INVALID_DTO,
} from '../__tests__/auth.factories';

jest.mock('@src/shared/config/env', () => ({
  ENV: {
    APP_ENV: 'development',
    IS_DEV: true,
    IS_PRODUCTION: false,
    API_URL: 'http://localhost:3000',
    SCHEME: 'aido',
    PLATFORM: 'ios',
    IS_IOS: true,
    IS_ANDROID: false,
  },
}));

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let publicHttpClient: ReturnType<typeof createMockHttpClient>;
  let authHttpClient: ReturnType<typeof createMockHttpClient>;
  let storage: ReturnType<typeof createMockStorage>;
  let service: AuthService;

  beforeEach(() => {
    publicHttpClient = createMockHttpClient();
    authHttpClient = createMockHttpClient();
    storage = createMockStorage();
    service = new AuthService(publicHttpClient, authHttpClient, storage);
  });

  // ── emailLogin ─────────────────────────────

  describe('emailLogin', () => {
    test('정상 응답 → 토큰 저장 + 도메인 모델 반환', async () => {
      // Given
      const dto = createAuthTokensDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.emailLogin('test@example.com', 'password123');

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith(
        'v1/auth/login',
        expect.objectContaining({ email: 'test@example.com', password: 'password123' }),
      );
      expect(storage.set).toHaveBeenCalledWith('accessToken', dto.accessToken);
      expect(storage.set).toHaveBeenCalledWith('refreshToken', dto.refreshToken);
      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          userId: dto.userId,
          userName: dto.name,
          userProfileImage: dto.profileImage,
        }),
      });
    });

    test('name null → userName null 매핑', async () => {
      // Given
      const dto = createAuthTokensDto({ name: null, profileImage: null });
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.emailLogin('test@example.com', 'password123');

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.userName).toBeNull();
        expect(result.value.userProfileImage).toBeNull();
      }
    });

    test('accountRestored 미포함 → 기본값 false', async () => {
      // Given
      const dto = createAuthTokensDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.emailLogin('test@example.com', 'password123');

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accountRestored).toBe(false);
      }
    });

    test('HTTP 에러 → Result.err + 토큰 미저장', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.emailLogin('test@example.com', 'wrong');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
      expect(storage.set).not.toHaveBeenCalled();
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.emailLogin('a@b.com', 'pw')).rejects.toThrow(
        'Invalid auth tokens response',
      );
    });
  });

  // ── exchangeCode ───────────────────────────

  describe('exchangeCode', () => {
    test('정상 응답 → 토큰 저장 + 도메인 모델 반환', async () => {
      // Given
      const dto = createAuthTokensDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });
      const input = { code: 'auth-code' };

      // When
      const result = await service.exchangeCode(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/exchange', input);
      expect(storage.set).toHaveBeenCalledWith('accessToken', dto.accessToken);
      expect(storage.set).toHaveBeenCalledWith('refreshToken', dto.refreshToken);
      expect(result.ok).toBe(true);
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.exchangeCode({ code: 'bad' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.exchangeCode({ code: 'code' })).rejects.toThrow(
        'Invalid auth tokens response',
      );
    });
  });

  // ── logout ─────────────────────────────────

  describe('logout', () => {
    test('성공 시 토큰 삭제', async () => {
      // Given
      authHttpClient.post.mockResolvedValue({ ok: true, value: undefined });

      // When
      const result = await service.logout();

      // Then
      expect(authHttpClient.post).toHaveBeenCalledWith('v1/auth/logout');
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('API 실패해도 토큰 삭제 (finally 보장)', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.logout();

      // Then
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('HttpClient throw 시에도 토큰 삭제 (finally 보장)', async () => {
      // Given
      authHttpClient.post.mockRejectedValue(new Error('network error'));

      // When & Then
      await expect(service.logout()).rejects.toThrow('network error');
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
    });
  });

  // ── verifyEmail ────────────────────────────

  describe('verifyEmail', () => {
    test('정상 응답 → 토큰 저장 + 도메인 모델 반환', async () => {
      // Given
      const dto = createAuthTokensDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });
      const input = { email: 'test@example.com', code: '123456' };

      // When
      const result = await service.verifyEmail(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/verify-email', input);
      expect(storage.set).toHaveBeenCalledWith('accessToken', dto.accessToken);
      expect(result.ok).toBe(true);
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.verifyEmail({ email: 'a@b.com', code: '000000' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.verifyEmail({ email: 'a@b.com', code: '000000' })).rejects.toThrow(
        'Invalid auth tokens response',
      );
    });
  });

  // ── getPreference ──────────────────────────

  describe('getPreference', () => {
    test('정상 응답 → pushEnabled, nightPushEnabled만 추출', async () => {
      // Given
      const dto = createPreferenceDto();
      authHttpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getPreference();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/auth/preference');
      expect(result).toEqual({
        ok: true,
        value: {
          pushEnabled: dto.pushEnabled,
          nightPushEnabled: dto.nightPushEnabled,
          morningReminderHour: dto.morningReminderHour,
          eveningReminderHour: dto.eveningReminderHour,
        },
      });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getPreference();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getPreference()).rejects.toThrow('Invalid getPreference response');
    });
  });

  // ── updatePreference ───────────────────────

  describe('updatePreference', () => {
    test('정상 응답 → 도메인 모델 반환', async () => {
      // Given
      const dto = createPreferenceDto();
      authHttpClient.patch.mockResolvedValue({ ok: true, value: dto });
      const input = { pushEnabled: false };

      // When
      const result = await service.updatePreference(input);

      // Then
      expect(authHttpClient.patch).toHaveBeenCalledWith('v1/auth/preference', input);
      expect(result).toEqual({
        ok: true,
        value: {
          pushEnabled: dto.pushEnabled,
          nightPushEnabled: dto.nightPushEnabled,
          morningReminderHour: dto.morningReminderHour,
          eveningReminderHour: dto.eveningReminderHour,
        },
      });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updatePreference({ pushEnabled: true });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.updatePreference({ pushEnabled: true })).rejects.toThrow(
        'Invalid updatePreference response',
      );
    });
  });

  // ── getConsent ──────────────────────────────

  describe('getConsent', () => {
    test('정상 응답 → ISO 문자열을 Date로 변환', async () => {
      // Given
      const termsAgreedAt = '2026-01-01T00:00:00.000Z';
      const privacyAgreedAt = '2026-01-01T00:00:00.000Z';
      const marketingAgreedAt = '2026-02-01T00:00:00.000Z';
      const dto = createConsentDto({ termsAgreedAt, privacyAgreedAt, marketingAgreedAt });
      authHttpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getConsent();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/auth/consent');
      expect(result).toEqual({
        ok: true,
        value: {
          termsAgreedAt: new Date(termsAgreedAt),
          privacyAgreedAt: new Date(privacyAgreedAt),
          agreedTermsVersion: dto.agreedTermsVersion,
          marketingAgreedAt: new Date(marketingAgreedAt),
        },
      });
    });

    test('marketingAgreedAt null → null 유지', async () => {
      // Given
      const dto = createConsentDto({ marketingAgreedAt: null });
      authHttpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getConsent();

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.marketingAgreedAt).toBeNull();
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getConsent();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getConsent()).rejects.toThrow('Invalid getConsent response');
    });
  });

  // ── updateMarketingConsent ──────────────────

  describe('updateMarketingConsent', () => {
    test('동의 → ISO를 Date로 변환', async () => {
      // Given
      const marketingAgreedAt = '2026-02-01T00:00:00.000Z';
      const dto = createUpdateMarketingConsentDto({ marketingAgreedAt });
      authHttpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.updateMarketingConsent({ agreed: true });

      // Then
      expect(authHttpClient.patch).toHaveBeenCalledWith('v1/auth/consent/marketing', {
        agreed: true,
      });
      expect(result).toEqual({
        ok: true,
        value: { marketingAgreedAt: new Date(marketingAgreedAt) },
      });
    });

    test('철회 → marketingAgreedAt null', async () => {
      // Given
      const dto = createUpdateMarketingConsentDto({ marketingAgreedAt: null });
      authHttpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.updateMarketingConsent({ agreed: false });

      // Then
      expect(result).toEqual({ ok: true, value: { marketingAgreedAt: null } });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.updateMarketingConsent({ agreed: false });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.updateMarketingConsent({ agreed: true })).rejects.toThrow(
        'Invalid updateMarketingConsent response',
      );
    });
  });

  // ── register ───────────────────────────────

  describe('register', () => {
    const registerInput = {
      email: 'test@example.com',
      password: 'Password1!',
      passwordConfirm: 'Password1!',
      name: '테스트',
      termsAgreed: true as const,
      privacyAgreed: true as const,
      marketingAgreed: false,
    };

    test('정상 응답 → RegisterResult 반환', async () => {
      // Given
      const dto = createRegisterDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.register(registerInput);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/register', registerInput);
      expect(result).toEqual({
        ok: true,
        value: { message: dto.message, email: dto.email },
      });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError({ code: 'EMAIL_ALREADY_EXISTS', status: 409 });
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.register(registerInput);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.register(registerInput)).rejects.toThrow('Invalid register response');
    });
  });

  // ── resendVerification ─────────────────────

  describe('resendVerification', () => {
    test('정상 응답 → retryAfterSeconds 포함', async () => {
      // Given
      const dto = createResendVerificationDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });
      const input = { email: 'test@example.com' };

      // When
      const result = await service.resendVerification(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/resend-verification', input);
      expect(result).toEqual({
        ok: true,
        value: {
          message: dto.message,
          email: dto.email,
          retryAfterSeconds: dto.retryAfterSeconds,
        },
      });
    });

    test('retryAfterSeconds 없음 → undefined', async () => {
      // Given
      const dto = createResendVerificationDto({ retryAfterSeconds: undefined });
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.resendVerification({ email: 'test@example.com' });

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.retryAfterSeconds).toBeUndefined();
      }
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.resendVerification({ email: 'a@b.com' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.resendVerification({ email: 'a@b.com' })).rejects.toThrow(
        'Invalid resendVerification response',
      );
    });
  });

  // ── getLinkedAccounts ──────────────────────

  describe('getLinkedAccounts', () => {
    test('정상 응답 → LinkedAccount 배열, linkedAt Date 변환', async () => {
      // Given
      const dto = createLinkedAccountsDto();
      authHttpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getLinkedAccounts();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/auth/linked-accounts');
      expect(result).toEqual({
        ok: true,
        value: [
          expect.objectContaining({
            provider: 'GOOGLE',
            linked: true,
            linkedAt: expect.any(Date),
          }),
          expect.objectContaining({
            provider: 'KAKAO',
            linked: false,
            linkedAt: null,
          }),
        ],
      });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getLinkedAccounts();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getLinkedAccounts()).rejects.toThrow(
        'Invalid getLinkedAccounts response',
      );
    });
  });

  // ── linkWithCode ───────────────────────────

  describe('linkWithCode', () => {
    test('성공 → 결과 반환', async () => {
      // Given
      const response = { message: '계정이 연동되었습니다.' };
      authHttpClient.post.mockResolvedValue({ ok: true, value: response });

      // When
      const result = await service.linkWithCode('auth-code-123');

      // Then
      expect(authHttpClient.post).toHaveBeenCalledWith('v1/auth/link-with-code', {
        code: 'auth-code-123',
      });
      expect(result).toEqual({ ok: true, value: response });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.linkWithCode('bad-code');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── unlinkAccount ──────────────────────────

  describe('unlinkAccount', () => {
    test('성공 → 결과 반환', async () => {
      // Given
      const response = { message: '계정 연동이 해제되었습니다.' };
      authHttpClient.delete.mockResolvedValue({ ok: true, value: response });

      // When
      const result = await service.unlinkAccount('GOOGLE');

      // Then
      expect(authHttpClient.delete).toHaveBeenCalledWith('v1/auth/linked-accounts/GOOGLE');
      expect(result).toEqual({ ok: true, value: response });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.unlinkAccount('KAKAO');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // ── changePassword ─────────────────────────

  describe('changePassword', () => {
    const input = {
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
      newPasswordConfirm: 'NewPass1!',
    };

    test('정상 응답 → ChangePasswordResult 반환', async () => {
      // Given
      const dto = createChangePasswordDto();
      authHttpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.changePassword(input);

      // Then
      expect(authHttpClient.patch).toHaveBeenCalledWith('v1/auth/password', input);
      expect(result).toEqual({ ok: true, value: { message: dto.message } });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError({
        code: 'WRONG_PASSWORD',
        message: '현재 비밀번호가 일치하지 않습니다',
      });
      authHttpClient.patch.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.changePassword(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.changePassword(input)).rejects.toThrow(
        'Invalid changePassword response',
      );
    });
  });

  // ── deleteAccount ──────────────────────────

  describe('deleteAccount', () => {
    const input = { password: 'Password1!', reason: '더 이상 사용하지 않음' };

    test('정상 응답 → 토큰 삭제 + DeleteAccountResult 반환', async () => {
      // Given
      const dto = createDeleteAccountDto();
      authHttpClient.delete.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.deleteAccount(input);

      // Then
      expect(authHttpClient.delete).toHaveBeenCalledWith('v1/auth/account', { body: input });
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          message: dto.message,
          deletedAt: expect.any(Date),
          gracePeriodDays: dto.gracePeriodDays,
        }),
      });
    });

    test('HTTP 에러 → Result.err + 토큰 미삭제', async () => {
      // Given
      const apiError = createAuthApiError({ code: 'WRONG_PASSWORD', status: 400 });
      authHttpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.deleteAccount(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
      expect(storage.remove).not.toHaveBeenCalled();
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.delete.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.deleteAccount(input)).rejects.toThrow('Invalid deleteAccount response');
    });

    test('토큰 삭제 실패해도 결과 반환', async () => {
      // Given
      const dto = createDeleteAccountDto();
      authHttpClient.delete.mockResolvedValue({ ok: true, value: dto });
      storage.remove.mockRejectedValueOnce(new Error('storage error'));

      // When & Then
      await expect(service.deleteAccount(input)).rejects.toThrow('storage error');
    });
  });

  // ── forgotPassword ────────────────────────

  describe('forgotPassword', () => {
    const input = { email: 'test@example.com' };

    test('정상 응답 → ForgotPasswordResult 반환', async () => {
      // Given
      const dto = createForgotPasswordDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.forgotPassword(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/forgot-password', input);
      expect(result).toEqual({ ok: true, value: { message: dto.message } });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.forgotPassword(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.forgotPassword(input)).rejects.toThrow(
        'Invalid forgotPassword response',
      );
    });
  });

  // ── resetPassword ────────────────────────

  describe('resetPassword', () => {
    const input = {
      email: 'test@example.com',
      code: '123456',
      newPassword: 'NewPass1!',
      newPasswordConfirm: 'NewPass1!',
    };

    test('정상 응답 → ResetPasswordResult 반환', async () => {
      // Given
      const dto = createResetPasswordDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.resetPassword(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/reset-password', input);
      expect(result).toEqual({ ok: true, value: { message: dto.message } });
    });

    test('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.resetPassword(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.resetPassword(input)).rejects.toThrow('Invalid resetPassword response');
    });
  });

  // ── OAuth 네이티브 메서드 ──────────────────
  // openKakaoLogin, openNaverLogin, openGoogleLogin, openAppleLogin,
  // linkAccount, linkApple 등은 expo-web-browser, expo-apple-authentication
  // 네이티브 모듈에 의존하므로 별도 통합/E2E 테스트에서 검증
});
