import {
  createHttpClientStub,
  createLoggerStub,
  createMemoryTokenStore,
  createSocialAuthGatewayStub,
} from '@src/testing/core';

import {
  createAuthApiError,
  createAuthTokensDto,
  createChangePasswordDto,
  createDeleteAccountDto,
  createForgotPasswordDto,
  createLinkedAccountsDto,
  createRegisterDto,
  createResendVerificationDto,
  createResetPasswordDto,
  INVALID_DTO,
} from '../__tests__/auth.fixtures';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let publicHttpClient: ReturnType<typeof createHttpClientStub>;
  let authHttpClient: ReturnType<typeof createHttpClientStub>;
  let tokenStore: ReturnType<typeof createMemoryTokenStore>;
  let socialAuthGateway: ReturnType<typeof createSocialAuthGatewayStub>;
  let service: AuthService;

  beforeEach(() => {
    publicHttpClient = createHttpClientStub();
    authHttpClient = createHttpClientStub();
    tokenStore = createMemoryTokenStore();
    socialAuthGateway = createSocialAuthGatewayStub();
    service = new AuthService({
      publicHttpClient,
      authHttpClient,
      tokenStore,
      socialAuthGateway,
      deviceType: 'IOS',
      logger: createLoggerStub(),
    });
  });

  describe('emailLogin', () => {
    it('서버 응답이 성공하면 토큰 저장 + 도메인 모델 반환', async () => {
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
      expect(tokenStore.save).toHaveBeenCalledWith({
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
      });
      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          userId: dto.userId,
          userName: dto.name,
          userProfileImage: dto.profileImage,
        }),
      });
    });

    it('name null → userName null 매핑', async () => {
      // Given
      const dto = createAuthTokensDto({ name: null, profileImage: null });
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.emailLogin('test@example.com', 'password123');

      // Then
      expect(result).toMatchObject({
        ok: true,
        value: { userName: null, userProfileImage: null },
      });
    });

    it('accountRestored 미포함 → 기본값 false', async () => {
      // Given
      const dto = createAuthTokensDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.emailLogin('test@example.com', 'password123');

      // Then
      expect(result).toMatchObject({ ok: true, value: { accountRestored: false } });
    });

    it('HTTP 에러 → Result.err + 토큰 미저장', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.emailLogin('test@example.com', 'wrong');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
      expect(tokenStore.save).not.toHaveBeenCalled();
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.emailLogin('a@b.com', 'pw');

      // Then
      await expect(result).rejects.toThrow('Invalid auth tokens response');
    });
  });

  describe('exchangeCode', () => {
    it('서버 응답이 성공하면 토큰 저장 + 도메인 모델 반환', async () => {
      // Given
      const dto = createAuthTokensDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });
      const input = { code: 'auth-code' };

      // When
      const result = await service.exchangeCode(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/exchange', input);
      expect(tokenStore.save).toHaveBeenCalledWith({
        accessToken: dto.accessToken,
        refreshToken: dto.refreshToken,
      });
      expect(result.ok).toBe(true);
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.exchangeCode({ code: 'bad' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.exchangeCode({ code: 'code' });

      // Then
      await expect(result).rejects.toThrow('Invalid auth tokens response');
    });
  });

  describe('logout', () => {
    it('성공하면 서버 세션만 끝내고 토큰은 지우지 않는다', async () => {
      // Given
      authHttpClient.post.mockResolvedValue({ ok: true, value: undefined });

      // When
      const result = await service.logout();

      // Then
      expect(authHttpClient.post).toHaveBeenCalledWith('v1/auth/logout', undefined, undefined);
      expect(tokenStore.clear).not.toHaveBeenCalled();
      expect(result).toEqual({ ok: true, value: undefined });
    });

    it('API 실패를 그대로 돌려준다', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.logout();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  describe('verifyEmail', () => {
    it('서버 응답이 성공하면 토큰 저장 + 도메인 모델 반환', async () => {
      // Given
      const dto = createAuthTokensDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });
      const input = { email: 'test@example.com', code: '123456' };

      // When
      const result = await service.verifyEmail(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/verify-email', input);
      expect(tokenStore.save).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: dto.accessToken }),
      );
      expect(result.ok).toBe(true);
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.verifyEmail({ email: 'a@b.com', code: '000000' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.verifyEmail({ email: 'a@b.com', code: '000000' });

      // Then
      await expect(result).rejects.toThrow('Invalid auth tokens response');
    });
  });

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

    it('서버 응답이 성공하면 RegisterResult 반환', async () => {
      // Given
      const dto = createRegisterDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.register(registerInput);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/register', registerInput);
      expect(result).toEqual({
        ok: true,
        value: { message: dto.message, email: dto.email, isEmailSent: true },
      });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError({ code: 'EMAIL_ALREADY_EXISTS', status: 409 });
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.register(registerInput);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.register(registerInput);

      // Then
      await expect(result).rejects.toThrow('Invalid register response');
    });
  });

  describe('resendVerification', () => {
    it('서버 응답이 성공하면 retryAfterSeconds 포함', async () => {
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

    it('retryAfterSeconds 없음 → undefined', async () => {
      // Given
      const dto = createResendVerificationDto({ retryAfterSeconds: undefined });
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.resendVerification({ email: 'test@example.com' });

      // Then
      expect(result).toMatchObject({ ok: true, value: { retryAfterSeconds: undefined } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.resendVerification({ email: 'a@b.com' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.resendVerification({ email: 'a@b.com' });

      // Then
      await expect(result).rejects.toThrow('Invalid resendVerification response');
    });
  });

  describe('getLinkedAccounts', () => {
    it('서버 응답이 성공하면 LinkedAccount 배열, linkedAt Instant 변환', async () => {
      // Given
      const dto = createLinkedAccountsDto();
      authHttpClient.get.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.getLinkedAccounts();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/auth/linked-accounts', {
        signal: undefined,
      });
      expect(result).toEqual({
        ok: true,
        value: {
          accounts: [
            expect.objectContaining({
              provider: 'GOOGLE',
              linked: true,
              linkedAt: expect.any(String),
            }),
            expect.objectContaining({
              provider: 'KAKAO',
              linked: false,
              linkedAt: null,
            }),
          ],
          canUnlink: true,
        },
      });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getLinkedAccounts();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.getLinkedAccounts();

      // Then
      await expect(result).rejects.toThrow('Invalid getLinkedAccounts response');
    });
  });

  describe('linkAccount(브라우저 연결 코드 교환)', () => {
    beforeEach(() => {
      socialAuthGateway.openOAuthSession.mockResolvedValue({
        type: 'success',
        url: 'aido://auth/google?code=auth-code-123',
        queryParams: { code: 'auth-code-123' },
      });
    });

    it('성공 → 결과 반환', async () => {
      // Given
      const response = { message: '계정이 연동되었습니다.' };
      authHttpClient.post.mockResolvedValue({ ok: true, value: response });

      // When
      const result = await service.linkAccount('google');

      // Then
      expect(authHttpClient.post).toHaveBeenCalledWith('v1/auth/link-with-code', {
        code: 'auth-code-123',
      });
      expect(result).toEqual({ ok: true, value: response });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.linkAccount('google');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  describe('unlinkAccount', () => {
    it('성공 → 결과 반환', async () => {
      // Given
      const response = { message: '계정 연동이 해제되었습니다.', provider: 'GOOGLE' as const };
      authHttpClient.delete.mockResolvedValue({ ok: true, value: response });

      // When
      const result = await service.unlinkAccount('GOOGLE');

      // Then
      expect(authHttpClient.delete).toHaveBeenCalledWith('v1/auth/linked-accounts/GOOGLE');
      expect(result).toEqual({ ok: true, value: response });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      authHttpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.unlinkAccount('KAKAO');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  describe('changePassword', () => {
    const input = {
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
      newPasswordConfirm: 'NewPass1!',
    };

    it('서버 응답이 성공하면 ChangePasswordResult 반환', async () => {
      // Given
      const dto = createChangePasswordDto();
      authHttpClient.patch.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.changePassword(input);

      // Then
      expect(authHttpClient.patch).toHaveBeenCalledWith('v1/auth/password', input);
      expect(result).toEqual({ ok: true, value: { message: dto.message } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
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

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.patch.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.changePassword(input);

      // Then
      await expect(result).rejects.toThrow('Invalid changePassword response');
    });
  });

  describe('deleteAccount', () => {
    const input = { password: 'Password1!', reason: '더 이상 사용하지 않음' };

    it('서버 응답이 성공하면 토큰 삭제 + DeleteAccountResult 반환', async () => {
      // Given
      const dto = createDeleteAccountDto();
      authHttpClient.delete.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.deleteAccount(input);

      // Then
      expect(authHttpClient.delete).toHaveBeenCalledWith('v1/auth/account', { body: input });
      expect(tokenStore.clear).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          message: dto.message,
          deletedAt: expect.any(String),
          gracePeriodDays: dto.gracePeriodDays,
        }),
      });
    });

    it('HTTP 에러 → Result.err + 토큰 미삭제', async () => {
      // Given
      const apiError = createAuthApiError({ code: 'WRONG_PASSWORD', status: 400 });
      authHttpClient.delete.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.deleteAccount(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
      expect(tokenStore.clear).not.toHaveBeenCalled();
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      authHttpClient.delete.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.deleteAccount(input);

      // Then
      await expect(result).rejects.toThrow('Invalid deleteAccount response');
    });

    it('토큰 삭제가 실패해도 탈퇴 결과를 성공으로 돌려준다', async () => {
      // Given
      const dto = createDeleteAccountDto();
      authHttpClient.delete.mockResolvedValue({ ok: true, value: dto });
      tokenStore.clear.mockRejectedValueOnce(new Error('storage error'));

      // When
      const result = await service.deleteAccount(input);

      // Then
      expect(result.ok).toBe(true);
    });
  });

  describe('forgotPassword', () => {
    const input = { email: 'test@example.com' };

    it('서버 응답이 성공하면 ForgotPasswordResult 반환', async () => {
      // Given
      const dto = createForgotPasswordDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.forgotPassword(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/forgot-password', input);
      expect(result).toEqual({ ok: true, value: { message: dto.message } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.forgotPassword(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.forgotPassword(input);

      // Then
      await expect(result).rejects.toThrow('Invalid forgotPassword response');
    });
  });

  describe('resetPassword', () => {
    const input = {
      email: 'test@example.com',
      code: '123456',
      newPassword: 'NewPass1!',
      newPasswordConfirm: 'NewPass1!',
    };

    it('서버 응답이 성공하면 ResetPasswordResult 반환', async () => {
      // Given
      const dto = createResetPasswordDto();
      publicHttpClient.post.mockResolvedValue({ ok: true, value: dto });

      // When
      const result = await service.resetPassword(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/reset-password', input);
      expect(result).toEqual({ ok: true, value: { message: dto.message } });
    });

    it('HTTP 에러 → Result.err 반환', async () => {
      // Given
      const apiError = createAuthApiError();
      publicHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.resetPassword(input);

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('Zod 검증 실패 → ParseError throw', async () => {
      // Given
      publicHttpClient.post.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When
      const result = service.resetPassword(input);

      // Then
      await expect(result).rejects.toThrow('Invalid resetPassword response');
    });
  });

  // OAuth open*Login은 네이티브 모듈에 의존해 통합/E2E 테스트에서 검증한다
});
