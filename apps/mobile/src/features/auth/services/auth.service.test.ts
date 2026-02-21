import type {
  AuthTokens as AuthTokensDTO,
  LinkedAccountsResponse,
  PreferenceResponse,
  RegisterResponse,
  ResendVerificationResponse,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { Storage } from '@src/core/ports/storage';
import { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';

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

// -- Fixtures --

const validAuthTokensDTO: AuthTokensDTO = {
  userId: 'clz7x5p8k0001qz0z8z8z8z8z',
  accessToken: 'access-token-jwt',
  refreshToken: 'refresh-token-jwt',
  name: '테스트',
  profileImage: 'https://example.com/avatar.jpg',
};

const validPreferenceDTO: PreferenceResponse = {
  pushEnabled: true,
  nightPushEnabled: false,
  timezone: 'Asia/Seoul',
  morningReminderHour: 8,
  eveningReminderHour: 21,
};

const validConsentDTO = {
  termsAgreedAt: '2026-01-01T00:00:00.000Z',
  privacyAgreedAt: '2026-01-01T00:00:00.000Z',
  agreedTermsVersion: '1.0.0',
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
};

const validUpdateMarketingConsentDTO = {
  marketingAgreedAt: '2026-02-01T00:00:00.000Z',
};

const validRegisterDTO: RegisterResponse = {
  message: '인증 메일이 발송되었습니다.',
  email: 'test@example.com',
};

const validResendVerificationDTO: ResendVerificationResponse = {
  message: '인증 메일이 재발송되었습니다.',
  email: 'test@example.com',
  retryAfterSeconds: 60,
};

const validLinkedAccountsDTO: LinkedAccountsResponse = {
  accounts: [
    {
      provider: 'GOOGLE',
      linked: true,
      providerAccountId: 'g-123',
      linkedAt: '2026-01-15T00:00:00.000Z',
    },
    { provider: 'KAKAO', linked: false, providerAccountId: null, linkedAt: null },
  ],
};

// -- Mock Helpers --

const createMockHttpClient = (): HttpClient => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});

const createMockStorage = (): Storage => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
});

const mockResolvedPost = (client: HttpClient, value: unknown) => {
  (client.post as jest.Mock).mockResolvedValue(value);
};

const mockResolvedGet = (client: HttpClient, value: unknown) => {
  (client.get as jest.Mock).mockResolvedValue(value);
};

const mockResolvedPatch = (client: HttpClient, value: unknown) => {
  (client.patch as jest.Mock).mockResolvedValue(value);
};

const mockResolvedDelete = (client: HttpClient, value: unknown) => {
  (client.delete as jest.Mock).mockResolvedValue(value);
};

describe('AuthService', () => {
  let publicHttpClient: HttpClient;
  let authHttpClient: HttpClient;
  let storage: Storage;
  let service: AuthService;

  const apiError = new ApiError('AUTH_ERROR', '인증 오류', 401);

  beforeEach(() => {
    publicHttpClient = createMockHttpClient();
    authHttpClient = createMockHttpClient();
    storage = createMockStorage();
    service = new AuthService(publicHttpClient, authHttpClient, storage);
  });

  // -- emailLogin --

  describe('emailLogin', () => {
    test('정상 응답 시 토큰을 저장하고 도메인 모델을 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: true, value: validAuthTokensDTO });

      // When
      const result = await service.emailLogin('test@example.com', 'password123');

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith(
        'v1/auth/login',
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
        }),
      );
      expect(storage.set).toHaveBeenCalledWith('accessToken', 'access-token-jwt');
      expect(storage.set).toHaveBeenCalledWith('refreshToken', 'refresh-token-jwt');
      expect(result).toEqual({
        ok: true,
        value: {
          userId: 'clz7x5p8k0001qz0z8z8z8z8z',
          accessToken: 'access-token-jwt',
          refreshToken: 'refresh-token-jwt',
          userName: '테스트',
          userProfileImage: 'https://example.com/avatar.jpg',
        },
      });
    });

    test('name이 null이면 userName도 null로 변환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, {
        ok: true,
        value: { ...validAuthTokensDTO, name: null, profileImage: null },
      });

      // When
      const result = await service.emailLogin('test@example.com', 'password123');

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.userName).toBeNull();
        expect(result.value.userProfileImage).toBeNull();
      }
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.emailLogin('test@example.com', 'wrong');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
      expect(storage.set).not.toHaveBeenCalled();
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.emailLogin('a@b.com', 'pw')).rejects.toThrow(ParseError);
    });
  });

  // -- exchangeCode --

  describe('exchangeCode', () => {
    test('정상 응답 시 토큰을 저장하고 도메인 모델을 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: true, value: validAuthTokensDTO });
      const input = { code: 'auth-code' };

      // When
      const result = await service.exchangeCode(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/exchange', input);
      expect(storage.set).toHaveBeenCalledWith('accessToken', 'access-token-jwt');
      expect(storage.set).toHaveBeenCalledWith('refreshToken', 'refresh-token-jwt');
      expect(result).toEqual({
        ok: true,
        value: {
          userId: 'clz7x5p8k0001qz0z8z8z8z8z',
          accessToken: 'access-token-jwt',
          refreshToken: 'refresh-token-jwt',
          userName: '테스트',
          userProfileImage: 'https://example.com/avatar.jpg',
        },
      });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.exchangeCode({ code: 'bad' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // -- logout --

  describe('logout', () => {
    test('성공 시 토큰을 삭제한다', async () => {
      // Given
      mockResolvedPost(authHttpClient, { ok: true, value: undefined });

      // When
      const result = await service.logout();

      // Then
      expect(authHttpClient.post).toHaveBeenCalledWith('v1/auth/logout');
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({ ok: true, value: undefined });
    });

    test('API 실패해도 토큰을 삭제한다', async () => {
      // Given
      mockResolvedPost(authHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.logout();

      // Then
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('HttpClient throw 시에도 토큰을 삭제한다', async () => {
      // Given
      (authHttpClient.post as jest.Mock).mockRejectedValue(new Error('network error'));

      // When & Then
      await expect(service.logout()).rejects.toThrow('network error');
      expect(storage.remove).toHaveBeenCalledWith('accessToken');
      expect(storage.remove).toHaveBeenCalledWith('refreshToken');
    });
  });

  // -- verifyEmail --

  describe('verifyEmail', () => {
    test('정상 응답 시 토큰을 저장하고 도메인 모델을 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: true, value: validAuthTokensDTO });
      const input = { email: 'test@example.com', code: '123456' };

      // When
      const result = await service.verifyEmail(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/verify-email', input);
      expect(storage.set).toHaveBeenCalledWith('accessToken', 'access-token-jwt');
      expect(storage.set).toHaveBeenCalledWith('refreshToken', 'refresh-token-jwt');
      expect(result).toEqual({
        ok: true,
        value: {
          userId: 'clz7x5p8k0001qz0z8z8z8z8z',
          accessToken: 'access-token-jwt',
          refreshToken: 'refresh-token-jwt',
          userName: '테스트',
          userProfileImage: 'https://example.com/avatar.jpg',
        },
      });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.verifyEmail({ email: 'a@b.com', code: '000000' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // -- getPreference --

  describe('getPreference', () => {
    test('정상 응답 시 pushEnabled, nightPushEnabled만 추출한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: true, value: validPreferenceDTO });

      // When
      const result = await service.getPreference();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/auth/preference');
      expect(result).toEqual({
        ok: true,
        value: {
          pushEnabled: true,
          nightPushEnabled: false,
        },
      });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.getPreference();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.getPreference()).rejects.toThrow(ParseError);
    });
  });

  // -- updatePreference --

  describe('updatePreference', () => {
    test('정상 응답 시 도메인 모델로 변환한다', async () => {
      // Given
      mockResolvedPatch(authHttpClient, { ok: true, value: validPreferenceDTO });
      const input = { pushEnabled: false };

      // When
      const result = await service.updatePreference(input);

      // Then
      expect(authHttpClient.patch).toHaveBeenCalledWith('v1/auth/preference', input);
      expect(result).toEqual({
        ok: true,
        value: {
          pushEnabled: true,
          nightPushEnabled: false,
        },
      });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedPatch(authHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.updatePreference({ pushEnabled: true });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedPatch(authHttpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.updatePreference({ pushEnabled: true })).rejects.toThrow(ParseError);
    });
  });

  // -- getConsent --

  describe('getConsent', () => {
    test('정상 응답 시 ISO 문자열을 Date 객체로 변환한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: true, value: validConsentDTO });

      // When
      const result = await service.getConsent();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/auth/consent');
      expect(result).toEqual({
        ok: true,
        value: {
          termsAgreedAt: new Date('2026-01-01T00:00:00.000Z'),
          privacyAgreedAt: new Date('2026-01-01T00:00:00.000Z'),
          agreedTermsVersion: '1.0.0',
          marketingAgreedAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      });
    });

    test('marketingAgreedAt이 null이면 null 그대로 전달한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, {
        ok: true,
        value: { ...validConsentDTO, marketingAgreedAt: null },
      });

      // When
      const result = await service.getConsent();

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.marketingAgreedAt).toBeNull();
      }
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.getConsent();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.getConsent()).rejects.toThrow(ParseError);
    });
  });

  // -- updateMarketingConsent --

  describe('updateMarketingConsent', () => {
    test('정상 응답 시 ISO 문자열을 Date 객체로 변환한다', async () => {
      // Given
      mockResolvedPatch(authHttpClient, { ok: true, value: validUpdateMarketingConsentDTO });

      // When
      const result = await service.updateMarketingConsent({ agreed: true });

      // Then
      expect(authHttpClient.patch).toHaveBeenCalledWith('v1/auth/consent/marketing', {
        agreed: true,
      });
      expect(result).toEqual({
        ok: true,
        value: {
          marketingAgreedAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      });
    });

    test('철회 시 marketingAgreedAt이 null로 변환된다', async () => {
      // Given
      mockResolvedPatch(authHttpClient, { ok: true, value: { marketingAgreedAt: null } });

      // When
      const result = await service.updateMarketingConsent({ agreed: false });

      // Then
      expect(result).toEqual({
        ok: true,
        value: { marketingAgreedAt: null },
      });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedPatch(authHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.updateMarketingConsent({ agreed: false });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedPatch(authHttpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.updateMarketingConsent({ agreed: true })).rejects.toThrow(ParseError);
    });
  });

  // -- register --

  describe('register', () => {
    test('정상 응답 시 RegisterResult를 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: true, value: validRegisterDTO });
      const input = {
        email: 'test@example.com',
        password: 'Password1!',
        passwordConfirm: 'Password1!',
        name: '테스트',
        termsAgreed: true as const,
        privacyAgreed: true as const,
        marketingAgreed: false,
      };

      // When
      const result = await service.register(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/register', input);
      expect(result).toEqual({
        ok: true,
        value: {
          message: '인증 메일이 발송되었습니다.',
          email: 'test@example.com',
        },
      });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.register({
        email: 'a@b.com',
        password: 'Password1!',
        passwordConfirm: 'Password1!',
        termsAgreed: true as const,
        privacyAgreed: true as const,
        marketingAgreed: false,
      });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(
        service.register({
          email: 'a@b.com',
          password: 'Password1!',
          passwordConfirm: 'Password1!',
          termsAgreed: true as const,
          privacyAgreed: true as const,
          marketingAgreed: false,
        }),
      ).rejects.toThrow(ParseError);
    });
  });

  // -- resendVerification --

  describe('resendVerification', () => {
    test('정상 응답 시 ResendVerificationResult를 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: true, value: validResendVerificationDTO });
      const input = { email: 'test@example.com' };

      // When
      const result = await service.resendVerification(input);

      // Then
      expect(publicHttpClient.post).toHaveBeenCalledWith('v1/auth/resend-verification', input);
      expect(result).toEqual({
        ok: true,
        value: {
          message: '인증 메일이 재발송되었습니다.',
          email: 'test@example.com',
          retryAfterSeconds: 60,
        },
      });
    });

    test('retryAfterSeconds가 없으면 undefined로 전달한다', async () => {
      // Given
      const dtoWithoutRetry: ResendVerificationResponse = {
        message: '인증 메일이 재발송되었습니다.',
        email: 'test@example.com',
      };
      mockResolvedPost(publicHttpClient, { ok: true, value: dtoWithoutRetry });

      // When
      const result = await service.resendVerification({ email: 'test@example.com' });

      // Then
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.retryAfterSeconds).toBeUndefined();
      }
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.resendVerification({ email: 'a@b.com' });

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedPost(publicHttpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.resendVerification({ email: 'a@b.com' })).rejects.toThrow(ParseError);
    });
  });

  // -- getLinkedAccounts --

  describe('getLinkedAccounts', () => {
    test('정상 응답 시 LinkedAccount 배열로 변환하고 linkedAt을 Date로 변환한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: true, value: validLinkedAccountsDTO });

      // When
      const result = await service.getLinkedAccounts();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/auth/linked-accounts');
      expect(result).toEqual({
        ok: true,
        value: [
          {
            provider: 'GOOGLE',
            linked: true,
            providerAccountId: 'g-123',
            linkedAt: new Date('2026-01-15T00:00:00.000Z'),
          },
          {
            provider: 'KAKAO',
            linked: false,
            providerAccountId: null,
            linkedAt: null,
          },
        ],
      });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.getLinkedAccounts();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    test('Zod 검증 실패 시 ParseError를 throw한다', async () => {
      // Given
      mockResolvedGet(authHttpClient, { ok: true, value: { invalid: 'data' } });

      // When & Then
      await expect(service.getLinkedAccounts()).rejects.toThrow(ParseError);
    });
  });

  // -- linkWithCode --

  describe('linkWithCode', () => {
    test('성공 시 결과를 반환한다', async () => {
      // Given
      const response = { message: '계정이 연동되었습니다.' };
      mockResolvedPost(authHttpClient, { ok: true, value: response });

      // When
      const result = await service.linkWithCode('auth-code-123');

      // Then
      expect(authHttpClient.post).toHaveBeenCalledWith('v1/auth/link-with-code', {
        code: 'auth-code-123',
      });
      expect(result).toEqual({ ok: true, value: response });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedPost(authHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.linkWithCode('bad-code');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });

  // -- unlinkAccount --

  describe('unlinkAccount', () => {
    test('성공 시 결과를 반환한다', async () => {
      // Given
      const response = { message: '계정 연동이 해제되었습니다.' };
      mockResolvedDelete(authHttpClient, { ok: true, value: response });

      // When
      const result = await service.unlinkAccount('GOOGLE');

      // Then
      expect(authHttpClient.delete).toHaveBeenCalledWith('v1/auth/linked-accounts/GOOGLE');
      expect(result).toEqual({ ok: true, value: response });
    });

    test('HTTP 에러 시 Result.err를 반환한다', async () => {
      // Given
      mockResolvedDelete(authHttpClient, { ok: false, error: apiError });

      // When
      const result = await service.unlinkAccount('KAKAO');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });
  });
});
